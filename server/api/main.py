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
from starlette.middleware.trustedhost import TrustedHostMiddleware

from api.config import settings
from api.middleware import CatchAllMiddleware, SecurityHeadersMiddleware, UploadSizeMiddleware, server_error
from api.models.database import get_engine
from api.routes import (
    account,
    canvas,
    canvas_courses,
    chat,
    conversations,
    documents,
    media,
    practice,
    search,
    study,
    videos,
    workspaces,
)

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


# add_middleware wraps what was added before it, so the last one added is the
# outermost: security headers see every response, and errors are turned into a
# response inside CORS so the browser can read them.
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
    return server_error(request, exc)


# media before videos: its /file/{path} route must win over /{video_id}.
ROUTERS = (chat, conversations, media, videos, workspaces, documents, canvas, canvas_courses, study, practice, search, account)
for module in ROUTERS:
    app.include_router(module.router)


@app.get("/")
def root():
    return {"name": "Pumped Up Kicks API"}


@app.get("/health")
def health():
    return {"status": "ok" if _database_reachable_cached() else "degraded"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
