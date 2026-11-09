"""Pumped Up Kicks API."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from api import errors, middleware
from api.config import settings
from api.models.database import get_engine
from api.routes import account, chat, media, videos

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")


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
    print(f"Starting Pumped Up Kicks API ({settings.environment})")
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


# The interactive docs describe every route and schema: useful locally, a free
# reconnaissance map in production.
docs = {} if not settings.is_production else {"docs_url": None, "redoc_url": None, "openapi_url": None}

app = FastAPI(
    title="Pumped Up Kicks API",
    description="Ask your lectures questions and get answers with timestamps.",
    version="2.1.0",
    lifespan=lifespan,
    **docs,
)

errors.install(app)
middleware.install(app)

for module in (chat, media, videos, account):  # media first: its /file/{path} route must win
    app.include_router(module.router)


@app.get("/")
def root():
    return {"message": "Pumped Up Kicks API"}


@app.get("/health")
def health():
    """
    Public liveness check. Says whether the service can answer, and nothing
    about how it is configured.
    """
    database = _database_reachable()
    return {
        "status": "ok" if database else "degraded",
        "database": "ok" if database else "unreachable",
        "ready": database and bool(settings.anthropic_api_key),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
