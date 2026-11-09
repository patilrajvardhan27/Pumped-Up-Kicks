"""Pumped Up Kicks API."""
import logging
import re
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError
from starlette.datastructures import MutableHeaders
from starlette.middleware.trustedhost import TrustedHostMiddleware

from api.config import settings
from api.models.database import get_engine
from api.routes import account, canvas, chat, documents, search, study, videos, workspaces
from api.services.errors import GENERIC_MESSAGE, new_request_id, request_id

log = logging.getLogger("api")


class _HideSecrets(logging.Filter):
    """
    Two kinds of URL carry a credential in the query string: the Canvas OAuth
    callback (a one-time authorization code) and the signed media links
    (`token=`). The access log keeps the path and drops the secret.
    """

    PATH = "/api/canvas/oauth/callback"
    MEDIA = "/api/videos/file/"
    TOKEN = re.compile(r"([?&]token=)[^&\s]*")

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            target = args[2]
            if target.startswith(self.PATH + "?"):
                record.args = args[:2] + (self.PATH + "?[hidden]",) + args[3:]
            elif target.startswith(self.MEDIA) and "token=" in target:
                record.args = args[:2] + (self.TOKEN.sub(r"\1[hidden]", target),) + args[3:]
        return True


logging.getLogger("uvicorn.access").addFilter(_HideSecrets())


_HEALTH_TTL = 10.0
_health_cache = {"at": 0.0, "ok": False}


def _database_reachable() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
        return True
    except Exception:
        return False


def _database_reachable_cached() -> bool:
    """The /health probe, so a flood of checks doesn't become a flood of connections."""
    now = time.monotonic()
    if now - _health_cache["at"] > _HEALTH_TTL or _health_cache["at"] == 0.0:
        _health_cache["ok"] = _database_reachable()
        _health_cache["at"] = now
    return _health_cache["ok"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "=" * 70)
    print("Starting Pumped Up Kicks API")
    print("=" * 70)

    # Report configuration at boot rather than failing on the first request.
    if _database_reachable():
        url = get_engine().url.render_as_string(hide_password=True)
        print(f"[Database] Connected: {url}")
    else:
        print("[Database] NOT REACHABLE")
        print("[Database] Check DATABASE_URL in server/.env, then run: alembic upgrade head")

    print(f"[Auth]     Mode: {settings.auth_mode}")
    if settings.auth_mode == "dev":
        print(f"[Auth]     Every request acts as '{settings.dev_user_id}' - not for production")

    print(f"[Storage]  Backend: {settings.storage_backend}")
    print(f"[Whisper]  Backend: {settings.transcribe_backend}")
    print(f"[Claude]   Model: {settings.puk_claude_model}")
    print(f"[Claude]   API key: {'found' if settings.anthropic_api_key else 'NOT SET'}")

    print("=" * 70 + "\n")
    yield
    print("\nShutting down.")


_docs = settings.is_development
app = FastAPI(
    title="Pumped Up Kicks API",
    description="Ask your lectures questions and get answers with timestamps.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)


# --- middleware --------------------------------------------------------------
# add_middleware wraps what was added before it, so the last one added is the
# outermost: security headers see every response, and errors are turned into a
# response inside CORS so the browser can read them.

UPLOAD_PATH = "/api/videos/upload"
# Multipart framing and form fields on top of the file itself.
UPLOAD_OVERHEAD_BYTES = 64 * 1024


def _server_error(request: Request, exc: Exception) -> JSONResponse:
    rid = request_id(request)
    log.error("Unhandled error on %s %s (request %s)", request.method, request.url.path, rid, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": GENERIC_MESSAGE, "request_id": rid})


class CatchAllMiddleware:
    """Turns an unhandled exception into the generic 500, inside the CORS layer."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def tracked(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked)
        except Exception as exc:
            if started:
                raise
            response = _server_error(Request(scope), exc)
            await response(scope, receive, send)


class UploadSizeMiddleware:
    """Refuses an oversized upload from its Content-Length, before the body is read."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["method"] == "POST" and scope["path"] == UPLOAD_PATH:
            declared = dict(scope["headers"]).get(b"content-length", b"")
            if declared.isdigit() and int(declared) > settings.max_upload_bytes + UPLOAD_OVERHEAD_BYTES:
                limit_gb = settings.max_upload_bytes // (1024 ** 3)
                response = JSONResponse(
                    status_code=413, content={"detail": f"That file is larger than the {limit_gb} GB limit."}
                )
                return await response(scope, receive, send)
        await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    """Gives every request an id and every response the standard hardening headers."""

    HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    }
    HSTS = "max-age=63072000; includeSubDomains"

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        rid = new_request_id()
        scope.setdefault("state", {})["request_id"] = rid

        async def with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in self.HEADERS.items():
                    headers[name] = value
                if not settings.is_development:
                    headers["Strict-Transport-Security"] = self.HSTS
                headers["X-Request-ID"] = rid
            await send(message)

        await self.app(scope, receive, with_headers)


app.add_middleware(CatchAllMiddleware)
app.add_middleware(UploadSizeMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
async def database_unavailable(request: Request, exc: Exception) -> JSONResponse:
    """
    A database that can't be reached is an outage, not a server bug.

    Answering 503 with a JSON `detail` lets the client show a real message, and
    because this handler sits inside the CORS middleware the browser can read it
    (an unhandled 500 is sent without CORS headers and surfaces as a CORS error).
    """
    # One line, not the 250-line SQLAlchemy chain, which repeats on every poll.
    reason = str(getattr(exc, "orig", exc)).strip().splitlines()[0]
    log.error("Database unavailable on %s %s: %s", request.method, request.url.path, reason)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The service is temporarily unavailable. Try again in a moment."
        },
        headers={"Retry-After": "5"},
    )


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Say which fields are wrong and why, without echoing what was sent."""
    problems = [
        {"loc": [str(part) for part in error.get("loc", ())], "msg": str(error.get("msg", "Invalid value"))}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": problems})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    return _server_error(request, exc)


app.include_router(chat.router)
app.include_router(videos.router)
app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(canvas.router)
app.include_router(study.router)
app.include_router(search.router)
app.include_router(account.router)


@app.get("/")
def root():
    return {"name": "Pumped Up Kicks API"}


@app.get("/health")
def health():
    return {"status": "ok" if _database_reachable_cached() else "degraded"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
