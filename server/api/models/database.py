"""
Postgres schema. Users own workspaces (one per subject), videos and documents
(course material imported from Canvas); videos and documents own chunks;
conversations own messages; messages cite chunks. A video, document or
conversation with no workspace is shown as "Unsorted".

Every user-facing read filters on user_id: see api/deps.py, which is the only
place a request-scoped session is handed out.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.config import settings
from api.models.base import Base
from api.models.canvas import CanvasConnection, OAuthNonce
from api.models.chat import AnswerCache, Conversation, Message, MessageSource
from api.models.library import Chunk, Document, User, Video, Workspace
from api.models.study import Deadline, StudyGuide, StudySet, UsageCharge

__all__ = [
    "AnswerCache", "Base", "CanvasConnection", "Chunk", "Conversation", "Deadline", "Document", "Message",
    "MessageSource", "OAuthNonce", "StudyGuide", "StudySet", "UsageCharge", "User", "Video", "Workspace",
    "get_engine", "get_session", "get_session_factory",
]


# --- engine / session -------------------------------------------------------

_engine = None
_SessionLocal = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            connect_args={"connect_timeout": 5},
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_factory():
    get_engine()
    return _SessionLocal


def get_session():
    return get_session_factory()()
