"""Users, their subjects, lectures, imported documents and the searchable chunks of both."""

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
    String,
    Text,
    UniqueConstraint,
    func,
    literal_column,
    text,
)
from sqlalchemy.orm import relationship

from api.config import settings
from api.models.base import Base


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
        # A course feeds exactly one subject.
        Index(
            "uq_workspaces_user_canvas_course", "user_id", "canvas_course_id",
            unique=True, postgresql_where=text("canvas_course_id is not null"),
        ),
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


class Document(Base):
    """
    Course material imported from Canvas: a file (PDF, PPTX, DOCX), a page, the
    syllabus, an announcement or an assignment's description. Chunked and
    embedded like a transcript, with a page or slide number where a lecture
    chunk has a timestamp.
    """

    __tablename__ = "documents"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(
        BigInteger, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )

    source = Column(String, nullable=False)
    canvas_course_id = Column(BigInteger, nullable=True)
    canvas_id = Column(BigInteger, nullable=True)

    title = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    # Where the student opens it: the item in Canvas, never a raw download link.
    url = Column(String, nullable=True)
    # As Canvas reports it. An unchanged timestamp means the item is not
    # downloaded or embedded again on the next sync.
    updated_at = Column(DateTime(timezone=True), nullable=True)
    content_hash = Column(String, nullable=True)

    module_name = Column(String, nullable=True)
    module_position = Column(Integer, nullable=True)
    num_pages = Column(Integer, nullable=True)
    num_chunks = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    synced_at = Column(DateTime(timezone=True), nullable=True)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "source in ('canvas_file', 'canvas_page', 'canvas_syllabus', "
            "'canvas_announcement', 'canvas_assignment')",
            name="ck_documents_source",
        ),
        UniqueConstraint(
            "user_id", "source", "canvas_course_id", "canvas_id", name="uq_documents_canvas_item"
        ),
        Index("ix_documents_user_workspace", "user_id", "workspace_id"),
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, user={self.user_id!r}, source={self.source!r})>"


class Chunk(Base):
    """
    A passage with its embedding, from exactly one lecture (with timestamps) or
    one document (with a page or slide number, where the format has pages).
    user_id is denormalised so the vector search can filter by owner without a
    join.
    """

    __tablename__ = "chunks"

    id = Column(BigInteger, primary_key=True)
    video_id = Column(BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=True)
    document_id = Column(
        BigInteger, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
    )
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    text = Column(Text, nullable=False)
    start_s = Column(Float, nullable=True)
    end_s = Column(Float, nullable=True)
    page = Column(Integer, nullable=True)
    embedding = Column(Vector(settings.embedding_dim), nullable=False)

    video = relationship("Video", back_populates="chunks")
    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        CheckConstraint(
            "(video_id is null) <> (document_id is null)", name="ck_chunks_one_parent"
        ),
        CheckConstraint(
            "video_id is null or (start_s is not null and end_s is not null)",
            name="ck_chunks_video_times",
        ),
        Index("ix_chunks_user_video", "user_id", "video_id"),
        Index("ix_chunks_user_document", "user_id", "document_id"),
        # Full-text search over transcripts and documents. An expression index,
        # so adding it didn't rewrite the table; queries must use the same
        # to_tsvector('english', text) expression to use it.
        Index(
            "ix_chunks_text_search",
            func.to_tsvector(literal_column("'english'"), text),
            postgresql_using="gin",
        ),
        # HNSW is overkill below ~100k rows but costs little; an exact scan is
        # the fallback the planner picks anyway when the filter is selective.
        Index(
            "ix_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
