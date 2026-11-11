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
import os
from pathlib import Path

from fastapi import Header
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from tests.fakes import FakeClaude, HashingEmbedder

# Settings are read at import. server/conftest.py does this under pytest.
os.environ.setdefault("ENV", "development")
os.environ.setdefault("AUTH_MODE", "dev")

from api.config import settings  # noqa: E402
from api.deps import RequestContext, _upsert_user, get_ctx  # noqa: E402
from api.main import app  # noqa: E402
from api.models import database  # noqa: E402
from tests.db_setup import ensure_database, migrate  # noqa: E402

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


def install_fakes() -> None:
    import api.services.embedder as embedder_module
    from api.routes import videos as videos_module

    embedder_module._embedder = HashingEmbedder()
    # Uploads in tests never reach Whisper.
    videos_module.run_pipeline = lambda video_id: None


def use_claude(reply: str = "It is covered [0:10].") -> FakeClaude:
    import api.services.lecture_rag_service as rag_module
    from api.services import study

    fake = FakeClaude(reply)
    rag_module.get_claude_client = lambda: fake
    study.get_claude_client = lambda: fake
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


def add_document(
    user_id: str, title: str, pages: list[str], workspace_id=None, canvas_id: int = 1,
    mime_type: str = "application/pdf",
) -> int:
    """An imported PDF with one indexed chunk per page."""
    from api.models.database import Chunk, Document, User

    db = session()
    try:
        if db.get(User, user_id) is None:
            db.add(User(id=user_id, email=f"{user_id}@test.local", plan="free"))
            db.commit()
        document = Document(
            user_id=user_id, workspace_id=workspace_id, source="canvas_file",
            canvas_course_id=1, canvas_id=canvas_id, title=title, mime_type=mime_type,
            url=f"https://canvas.test.edu/courses/1/files/{canvas_id}",
            num_pages=len(pages), num_chunks=len(pages),
        )
        db.add(document)
        db.commit()
        embedder = HashingEmbedder()
        db.add_all([
            Chunk(document_id=document.id, user_id=user_id, text=text_, page=i + 1,
                  embedding=embedder.embed_one(text_))
            for i, text_ in enumerate(pages)
        ])
        db.commit()
        return document.id
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
