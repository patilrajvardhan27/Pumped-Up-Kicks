"""Conversations, their messages, the chunks each answer cited, and the per-user answer cache."""
from datetime import datetime

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
    func,
)
from sqlalchemy.orm import relationship

from api.models.base import Base


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
    # 1-based place in the list the model was given. An answer cites document
    # passages by it ([Doc 3]), so the order has to survive a reload.
    position = Column(Integer, nullable=True)

    message = relationship("Message", back_populates="sources")
    chunk = relationship("Chunk")


class AnswerCache(Base):
    """Scoped per user: a global cache would serve one student's answer to
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
