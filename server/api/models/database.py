"""
Postgres schema. Users own workspaces (one per subject) and videos; videos own
chunks and conversations; conversations own messages; messages cite chunks.
A video or conversation with no workspace is shown as "Unsorted".

Every user-facing read filters on user_id — see api/deps.py, which is the only
place a request-scoped session is handed out.
"""
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    REAL,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

from api.config import settings


class Base(DeclarativeBase):
    pass


class User(Base):
    """Mirrors the identity provider. `id` is the Clerk user id (or dev_user_id)."""

    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    plan = Column(String, nullable=False, default="free")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id!r}, plan={self.plan!r})>"


class Workspace(Base):
    """One subject: a named, coloured group of lectures and the chats about them."""

    __tablename__ = "workspaces"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String, nullable=False)
    # Keys into a fixed palette and icon set (see api/routes/workspaces.py),
    # so the client maps them onto design tokens rather than storing raw hex.
    color = Column(String, nullable=False, default="blue")
    icon = Column(String, nullable=False, default="book")
    position = Column(Integer, nullable=False, default=0)

    # Set when this workspace mirrors a Canvas course.
    canvas_course_id = Column(BigInteger, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_workspaces_user_name"),
        Index("ix_workspaces_user_position", "user_id", "position"),
    )

    def __repr__(self) -> str:
        return f"<Workspace(id={self.id}, user={self.user_id!r}, name={self.name!r})>"


class Video(Base):
    __tablename__ = "videos"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # The subject this lecture is filed under; null is "Unsorted". Deleting the
    # workspace moves its lectures to Unsorted rather than deleting them.
    workspace_id = Column(
        BigInteger, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )

    filename = Column(String, nullable=False)
    title = Column(String, nullable=True)

    # Object key in the storage backend, never a local absolute path.
    storage_key = Column(String, nullable=False)

    duration_s = Column(Float, nullable=True)
    file_size = Column(BigInteger, nullable=True)

    stage = Column(String, nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    num_segments = Column(Integer, nullable=True)
    num_chunks = Column(Integer, nullable=True)

    # Handle for an in-flight remote transcription job, when one is used.
    job_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="videos")
    chunks = relationship("Chunk", back_populates="video", cascade="all, delete-orphan")

    __table_args__ = (
        # Was globally unique, which meant two users could not both upload
        # a file called lecture1.mp4.
        UniqueConstraint("user_id", "filename", name="uq_videos_user_filename"),
        Index("ix_videos_user_created", "user_id", "created_at"),
        Index("ix_videos_user_workspace", "user_id", "workspace_id"),
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, user={self.user_id!r}, stage={self.stage!r})>"


class Chunk(Base):
    """A passage of transcript with its embedding. user_id is denormalised so
    the vector search can filter by owner without a join."""

    __tablename__ = "chunks"

    id = Column(BigInteger, primary_key=True)
    video_id = Column(BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    text = Column(Text, nullable=False)
    start_s = Column(Float, nullable=False)
    end_s = Column(Float, nullable=False)
    embedding = Column(Vector(settings.embedding_dim), nullable=False)

    video = relationship("Video", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_user_video", "user_id", "video_id"),
        # HNSW is overkill below ~100k rows but costs little; an exact scan is
        # the fallback the planner picks anyway when the filter is selective.
        Index(
            "ix_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Conversation(Base):
    """
    A chat thread, and what it searches. `scope` is one of:

    - video: one lecture (video_id).
    - workspace: one subject (workspace_id), or the Unsorted lectures when
      workspace_id is null.
    - all: every lecture the user has.

    workspace_id is also where the thread is filed in the sidebar. A thread
    about one lecture is filed with that lecture and moves when it moves.

    The scope is stored rather than inferred from which ids are null, because
    workspace_id null already means Unsorted: inferring would turn a subject's
    threads into whole-library threads the moment the subject was deleted.
    """

    __tablename__ = "conversations"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=True)
    workspace_id = Column(
        BigInteger, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    scope = Column(String, nullable=False, default="all", server_default="all")

    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=datetime.utcnow
    )

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    __table_args__ = (
        CheckConstraint("scope in ('video', 'workspace', 'all')", name="ck_conversations_scope"),
        # video_id cascades on delete, so a lecture thread never loses its lecture.
        CheckConstraint(
            "(scope = 'video') = (video_id is not null)", name="ck_conversations_scope_video"
        ),
        CheckConstraint(
            "scope <> 'all' or workspace_id is null", name="ck_conversations_scope_all"
        ),
        Index("ix_conversations_user_video", "user_id", "video_id", "created_at"),
        Index("ix_conversations_user_workspace", "user_id", "workspace_id", "updated_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True)
    conversation_id = Column(
        BigInteger, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )

    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    model = Column(String, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    cache_hit = Column(Integer, nullable=False, default=0)
    response_time_s = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sources = relationship(
        "MessageSource", back_populates="message", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("role in ('user', 'assistant')", name="ck_messages_role"),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )


class MessageSource(Base):
    """The citations behind an answer. Without this the tape strip only exists
    in React state and disappears on reload."""

    __tablename__ = "message_sources"

    message_id = Column(
        BigInteger, ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    chunk_id = Column(BigInteger, ForeignKey("chunks.id", ondelete="CASCADE"), primary_key=True)
    similarity = Column(REAL, nullable=True)

    message = relationship("Message", back_populates="sources")
    chunk = relationship("Chunk")


class AnswerCache(Base):
    """Scoped per user — a global cache would serve one student's answer to
    another. The key also carries the conversation's scope, so an answer
    cached in one subject is never served in another (see
    LectureRAGService.cache_key)."""

    __tablename__ = "answer_cache"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cache_key = Column(String, nullable=False)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True)
    model = Column(String, nullable=True)
    hits = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "cache_key", name="uq_answer_cache_user_key"),
    )


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
