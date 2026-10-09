"""
Shared set-up for the tests that need Postgres.

They run against their own database (TEST_DATABASE_URL, default kicks_test on
the local server), created and migrated on first use and emptied before every
test. If Postgres is not reachable they are skipped, not failed, so the pure
tests still run anywhere.

Two things are swapped out, both outside the code under test:

- Identity. get_ctx is overridden to trust an X-Test-User header, so a test can
  act as two different users. Every route still filters by the user it is
  handed, which is exactly what the isolation tests exercise.
- The embedding model, which is a download. A small hashing embedder stands in:
  texts that share words land near each other, which is all retrieval needs.
"""
import hashlib
import math
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

SERVER_DIR = Path(__file__).resolve().parent.parent

import api.services.lecture_rag_service  # noqa: E402,F401  (puts server/src on sys.path)
from api.config import settings  # noqa: E402
from api.deps import RequestContext, _upsert_user, get_ctx  # noqa: E402
from api.main import app  # noqa: E402
from api.models import database  # noqa: E402

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://postgres@127.0.0.1:5432/kicks_test"
)


class Skip(Exception):
    """Raised when the database tests cannot run here."""


def skip(reason: str):
    try:
        import pytest
    except ImportError:
        raise Skip(reason)
    pytest.skip(reason)


# --- database ---------------------------------------------------------------


def ensure_database(url: str, recreate: bool = False) -> None:
    """Create the database (with pgvector) if it does not exist yet."""
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.execute(
                text("select 1 from pg_database where datname = :name"),
                {"name": target.database},
            ).scalar()
            if exists and recreate:
                conn.execute(text(f'drop database "{target.database}" with (force)'))
                exists = False
            if not exists:
                conn.execute(text(f'create database "{target.database}"'))
    finally:
        admin.dispose()


def alembic_config():
    from alembic.config import Config

    config = Config(str(SERVER_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    return config


def migrate(url: str, revision: str = "head", direction: str = "upgrade") -> None:
    """Run alembic against `url`. alembic/env.py reads the URL from settings."""
    from alembic import command

    previous = settings.database_url
    settings.database_url = url
    try:
        getattr(command, direction)(alembic_config(), revision)
    finally:
        settings.database_url = previous


def use_database(url: str) -> None:
    """Point the app's engine at `url`."""
    if database._engine is not None:
        database._engine.dispose()
    settings.database_url = url
    database._engine = None
    database._SessionLocal = None


_prepared = False


def fresh() -> None:
    """An empty, fully migrated test database, with the stand-ins installed."""
    global _prepared
    if not _prepared:
        try:
            ensure_database(TEST_DATABASE_URL)
        except OperationalError as e:
            skip(f"Postgres not reachable at {TEST_DATABASE_URL}: {str(e).splitlines()[0]}")
        migrate(TEST_DATABASE_URL)
        use_database(TEST_DATABASE_URL)
        install_fakes()
        _prepared = True

    with database.get_engine().begin() as conn:
        # Every table hangs off users, so this empties the lot.
        conn.execute(text("truncate users, answer_cache restart identity cascade"))

    # Rate limits are counted in memory per process; start each test with a clean slate.
    import gc

    from api.services.ratelimit import SlidingWindowLimiter

    for limiter in (o for o in gc.get_objects() if isinstance(o, SlidingWindowLimiter)):
        limiter._hits.clear()


def session():
    return database.get_session()


# --- identity ---------------------------------------------------------------


def _ctx_from_header(x_test_user: str = Header(...)):
    db = database.get_session()
    try:
        user = _upsert_user(db, {"id": x_test_user, "email": f"{x_test_user}@test.local"})
        yield RequestContext(db=db, user=user)
    finally:
        db.close()


def client(user_id: str) -> TestClient:
    """An API client that acts as `user_id`."""
    app.dependency_overrides[get_ctx] = _ctx_from_header
    return TestClient(app, headers={"X-Test-User": user_id})


# --- stand-ins --------------------------------------------------------------


class HashingEmbedder:
    """Bag of words hashed into the real model's 384 dimensions, L2-normalised."""

    embedding_dim = 384

    def _vector(self, text_: str):
        vector = [0.0] * self.embedding_dim
        for word in re.findall(r"\w+", text_.lower()):
            index = int(hashlib.md5(word.encode()).hexdigest(), 16) % self.embedding_dim
            vector[index] += 1.0
        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            vector[0], norm = 1.0, 1.0
        return [v / norm for v in vector]

    def embed_one(self, text_: str):
        return self._vector(text_)

    def embed_many(self, texts, batch_size: int = 64):
        return [self._vector(t) for t in texts]


class FakeClaude:
    """Answers with a fixed reply and records what it was sent."""

    USAGE = {
        "input_tokens": 100, "output_tokens": 5, "cache_read_tokens": 0,
        "cache_write_tokens": 0, "model": "test-model", "cost_usd": 0.001,
    }

    def __init__(self, reply: str = "It is covered [0:10]."):
        self.reply = reply
        self.prompts: list[str] = []

    def stream(self, system, user):
        self.prompts.append(user)
        yield {"type": "delta", "text": self.reply}
        yield {"type": "done", "text": self.reply, "usage": dict(self.USAGE)}

    def complete(self, system, user, max_tokens: Optional[int] = None):
        from services.llm.claude_client import ClaudeUsage

        self.prompts.append(user)
        usage = ClaudeUsage(**{k: v for k, v in self.USAGE.items() if k != "cost_usd"})
        usage.cost_usd = self.USAGE["cost_usd"]
        return {"text": self.reply, "usage": usage, "stop_reason": "end_turn", "elapsed": 0.0}


def install_fakes() -> None:
    import services.embeddings.embedder as embedder_module

    from api.routes import videos as videos_module

    embedder_module._embedder = HashingEmbedder()
    # Uploads in tests never reach Whisper.
    videos_module.run_pipeline = lambda video_id: None


def use_claude(reply: str = "It is covered [0:10].") -> FakeClaude:
    import api.services.lecture_rag_service as rag_module

    fake = FakeClaude(reply)
    rag_module.get_claude_client = lambda: fake
    return fake


def use_storage(root: Path) -> None:
    """Keep uploaded test files out of server/data/uploads."""
    from api.services import storage

    storage._storage = storage.LocalStorage(root=root)


# --- fixtures ---------------------------------------------------------------


def add_video(user_id: str, title: str, transcript: list[str], workspace_id=None) -> int:
    """A ready lecture with one indexed chunk per transcript line, 30 seconds each."""
    from api.models.database import Chunk, User, Video

    db = session()
    try:
        if db.get(User, user_id) is None:
            db.add(User(id=user_id, email=f"{user_id}@test.local", plan="free"))
            db.commit()
        video = Video(
            user_id=user_id, workspace_id=workspace_id, filename=f"{title}.mp4", title=title,
            storage_key=f"users/{user_id}/{title}.mp4", stage="ready", progress=100,
            duration_s=30.0 * len(transcript), num_chunks=len(transcript),
        )
        db.add(video)
        db.commit()
        embedder = HashingEmbedder()
        db.add_all([
            Chunk(
                video_id=video.id, user_id=user_id, text=line,
                start_s=30.0 * i, end_s=30.0 * (i + 1), embedding=embedder.embed_one(line),
            )
            for i, line in enumerate(transcript)
        ])
        db.commit()
        return video.id
    finally:
        db.close()


def run(namespace: dict) -> None:
    """The `python -m tests.<module>` runner used across this package."""
    tests = [t for name, t in sorted(namespace.items()) if name.startswith("test_")]
    try:
        for t in tests:
            t()
    except Skip as e:
        print(f"skipped: {e}")
        return
    print(f"{len(tests)} checks passed")
