"""Pumped Up Kicks API."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from api.config import settings
from api.models.database import get_engine
from api.routes import chat, videos


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

app.include_router(chat.router)
app.include_router(videos.router)


@app.get("/")
def root():
    return {
        "message": "Pumped Up Kicks API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "presign": "/api/videos/presign",
            "videos": "/api/videos",
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
