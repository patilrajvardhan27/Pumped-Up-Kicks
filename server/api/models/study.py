"""Canvas deadlines, the usage ledger, and generated study guides and practice sets."""
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)

from api.models.base import Base


class Deadline(Base):
    """An assignment due date from Canvas. Title and date only: never the work itself."""

    __tablename__ = "deadlines"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(
        BigInteger, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )

    canvas_course_id = Column(BigInteger, nullable=False)
    canvas_assignment_id = Column(BigInteger, nullable=False)
    title = Column(String, nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    url = Column(String, nullable=True)
    points_possible = Column(Float, nullable=True)
    # Quizzes keep their date only; their content is never imported.
    is_quiz = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "user_id", "canvas_course_id", "canvas_assignment_id", name="uq_deadlines_canvas_item"
        ),
        Index("ix_deadlines_user_workspace_due", "user_id", "workspace_id", "due_at"),
    )


class UsageCharge(Base):
    """
    What a Claude call outside chat cost: a study guide or a practice set,
    including calls whose reply was unusable and so produced nothing to keep.
    The monthly quota sums these alongside chat messages.
    """

    __tablename__ = "usage_charges"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    purpose = Column(String, nullable=False)
    model = Column(String, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("purpose in ('study_guide', 'practice')", name="ck_usage_charges_purpose"),
        Index("ix_usage_charges_user_created", "user_id", "created_at"),
    )


class StudyGuide(Base):
    """
    A lecture's summary, key terms and timestamped outline. Generated once, on
    request, and kept: asking again returns the stored guide rather than paying
    for a new one. What it cost is recorded in usage_charges.
    """

    __tablename__ = "study_guides"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(
        BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    summary = Column(Text, nullable=False)
    # JSON lists: [{"term", "definition", "start"}], [{"start", "title"}].
    key_terms = Column(Text, nullable=False)
    outline = Column(Text, nullable=False)
    # Set when the transcript was too long to send whole: the guide covers up to here.
    covered_until_s = Column(Float, nullable=True)

    model = Column(String, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_study_guides_user", "user_id"),)


class StudySet(Base):
    """
    Practice questions or flashcards made from one subject's lectures and
    course material. Every item carries the passage its answer comes from.
    """

    __tablename__ = "study_sets"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(
        BigInteger, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )

    kind = Column(String, nullable=False)
    focus = Column(String, nullable=True)
    # JSON list of items, each with its citation (see api/services/study.py).
    items = Column(Text, nullable=False)

    model = Column(String, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("kind in ('questions', 'flashcards')", name="ck_study_sets_kind"),
        Index("ix_study_sets_user_workspace", "user_id", "workspace_id", "created_at"),
    )
