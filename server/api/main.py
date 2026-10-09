"""Pumped Up Kicks API."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError

from api.config import settings
from api.models.database import get_engine
from api.routes import canvas, chat, documents, search, study, videos, workspaces


class _HideOAuthCode(logging.Filter):
    """
    The Canvas OAuth callback carries a one-time authorization code in its
    query string. The access log keeps the path and drops the query, so the
    code never lands in a log file.
    """

    PATH = "/api/canvas/oauth/callback"

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            if args[2].startswith(self.PATH + "?"):
                record.args = args[:2] + (self.PATH + "?[hidden]",) + args[3:]
        return True


logging.getLogger("uvicorn.access").addFilter(_HideOAuthCode())


def _database_reachable() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
        return True
    except Exception:
        return False


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


app = FastAPI(
    title="Pumped Up Kicks API",
    description="Ask your lectures questions and get answers with timestamps.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    print(f"[Database] {request.method} {request.url.path}: {reason}")
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Can't reach the database. Check that Postgres is running and "
                      "that DATABASE_URL in server/.env is correct."
        },
        headers={"Retry-After": "5"},
    )


app.include_router(chat.router)
app.include_router(videos.router)
app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(canvas.router)
app.include_router(study.router)
app.include_router(search.router)


@app.get("/")
def root():
    return {
        "message": "Pumped Up Kicks API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "presign": "/api/videos/presign",
            "videos": "/api/videos",
            "workspaces": "/api/workspaces",
            "documents": "/api/documents",
            "canvas": "/api/canvas/connection",
            "search": "/api/search",
            "deadlines": "/api/deadlines",
            "chat": "/api/chat/query",
            "chat_stream": "/api/chat/stream",
            "conversations": "/api/chat/conversations",
            "usage": "/api/chat/usage",
        },
    }


@app.get("/health")
def health():
    """Liveness plus enough configuration detail for the client to warn early."""
    ok = _database_reachable()
    return {
        "status": "ok" if ok else "degraded",
        "database": "ok" if ok else "unreachable",
        "model": settings.puk_claude_model,
        "claude_configured": bool(settings.anthropic_api_key),
        "auth_mode": settings.auth_mode,
        "storage_backend": settings.storage_backend,
        "transcribe_backend": settings.transcribe_backend,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
