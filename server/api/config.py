"""
Application settings, read once from the environment (and server/.env).

Every external dependency has a local fallback so the app still runs on a laptop
with nothing configured: auth falls back to a single dev user, storage to the
local disk, transcription to an in-process Whisper run. Setting the corresponding
env vars switches each one to its production backend independently.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SERVER_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -- database --------------------------------------------------------
    # Postgres with the pgvector extension. Local default matches the
    # docker-compose / brew setup described in SETUP.md.
    database_url: str = "postgresql+psycopg://postgres@127.0.0.1:5432/kicks_dev"

    # -- Claude ----------------------------------------------------------
    anthropic_api_key: str | None = None
    puk_claude_model: str = "claude-sonnet-5"
    puk_claude_effort: str = "low"
    puk_claude_max_tokens: int = 2000

    # -- auth ------------------------------------------------------------
    # "dev" trusts a single built-in user and requires no Clerk account.
    # "clerk" verifies a real Clerk session JWT against their JWKS.
    auth_mode: Literal["dev", "clerk"] = "dev"
    clerk_jwks_url: str | None = None
    clerk_issuer: str | None = None
    dev_user_id: str = "dev_user"
    dev_user_email: str = "dev@localhost"

    # -- storage ---------------------------------------------------------
    # "local" writes to data/uploads. "r2" issues presigned URLs so the
    # browser uploads straight to Cloudflare R2 and the API never sees bytes.
    storage_backend: Literal["local", "r2"] = "local"
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str = "kicks-lectures"
    presign_expiry_seconds: int = 3600

    # -- transcription ---------------------------------------------------
    # "local" runs Whisper in a subprocess. "modal" dispatches to a
    # serverless GPU worker (see modal_app.py).
    transcribe_backend: Literal["local", "modal"] = "local"
    modal_app_name: str = "kicks-transcribe"
    whisper_model_size: str = "base"

    # -- embeddings ------------------------------------------------------
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384

    # -- retrieval -------------------------------------------------------
    default_top_k: int = 5
    max_context_tokens: int = 12000

    # -- quotas ----------------------------------------------------------
    # Monthly ceilings per plan, in USD of Claude spend. A user at their cap
    # gets a clear message rather than a silent failure.
    free_plan_monthly_usd: float = 1.00
    pro_plan_monthly_usd: float = 20.00
    max_upload_bytes: int = 4 * 1024 * 1024 * 1024

    # -- web -------------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Signs the short-lived media URLs a <video> element loads directly.
    # Override in production: a known secret means anyone can mint playback links.
    secret_key: str = "dev-insecure-change-me"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def uploads_dir(self) -> Path:
        path = SERVER_DIR / "data" / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def transcripts_dir(self) -> Path:
        path = SERVER_DIR / "data" / "transcriptions"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def plan_limit_usd(self, plan: str) -> float:
        return self.pro_plan_monthly_usd if plan == "pro" else self.free_plan_monthly_usd


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
