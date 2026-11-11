"""A user's Canvas sign-in and the one-time values that protect the OAuth round trip."""
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)

from api.models.base import Base


class CanvasConnection(Base):
    """
    One student's link to their school's Canvas. Tokens are stored encrypted
    (api/services/canvas_auth.py), are never sent to the client, and are never
    logged. Sync progress lives here so the client can poll it, as it polls a
    lecture's pipeline.
    """

    __tablename__ = "canvas_connections"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    base_url = Column(String, nullable=False)
    auth_type = Column(String, nullable=False)
    access_token_enc = Column(Text, nullable=False)
    refresh_token_enc = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    canvas_user_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    sync_stage = Column(String, nullable=False, default="idle", server_default="idle")
    sync_progress = Column(Integer, nullable=False, default=0, server_default="0")
    sync_detail = Column(String, nullable=True)
    sync_error = Column(Text, nullable=True)
    sync_started_at = Column(DateTime(timezone=True), nullable=True)
    sync_finished_at = Column(DateTime(timezone=True), nullable=True)
    # JSON: what the last sync added, updated, left alone, removed and skipped.
    sync_summary = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("auth_type in ('oauth', 'personal_token')", name="ck_canvas_auth_type"),
        CheckConstraint(
            "sync_stage in ('idle', 'queued', 'syncing', 'ready', 'failed')",
            name="ck_canvas_sync_stage",
        ),
    )

    def __repr__(self) -> str:
        # Deliberately leaves the tokens out.
        return f"<CanvasConnection(user={self.user_id!r}, base_url={self.base_url!r})>"


class OAuthNonce(Base):
    """
    A Canvas sign-in the server started and has not finished. The signed state
    carries the nonce; finishing the sign-in deletes the row, so a state works
    once, and only for the user it was issued to.
    """

    __tablename__ = "oauth_nonces"

    nonce = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_oauth_nonces_expires", "expires_at"),)
