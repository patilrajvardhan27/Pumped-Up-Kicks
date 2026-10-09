"""
Per-user spend limits, and a limit on how much material is indexed.

Spend is summed from the messages table rather than tracked separately, so the
quota can never drift from what was actually billed. Checked before every
Claude call — without this, one enthusiastic user is the whole API budget.

Indexed material is counted the same way, from the chunks table: lectures and
imported course material together. It costs storage and search time rather
than Claude spend, so it has its own allowance per plan. Canvas imports stop
at it; lecture uploads are counted but not stopped by it.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.config import settings
from api.models.database import Chunk, Conversation, Message, User


@dataclass
class QuotaStatus:
    spent_usd: float
    limit_usd: float
    plan: str

    @property
    def remaining_usd(self) -> float:
        return max(0.0, self.limit_usd - self.spent_usd)

    @property
    def exhausted(self) -> bool:
        return self.spent_usd >= self.limit_usd

    @property
    def percent_used(self) -> int:
        if self.limit_usd <= 0:
            return 100
        return min(100, int(self.spent_usd / self.limit_usd * 100))

    def to_dict(self) -> dict:
        return {
            "plan": self.plan,
            "spent_usd": round(self.spent_usd, 4),
            "limit_usd": self.limit_usd,
            "remaining_usd": round(self.remaining_usd, 4),
            "percent_used": self.percent_used,
            "exhausted": self.exhausted,
        }


def month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def spend_this_month(db: Session, user_id: str) -> float:
    total = db.execute(
        select(func.coalesce(func.sum(Message.cost_usd), 0))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Conversation.user_id == user_id,
            Message.created_at >= month_start(),
        )
    ).scalar_one()
    return float(total or 0.0)


def get_quota(db: Session, user: User) -> QuotaStatus:
    return QuotaStatus(
        spent_usd=spend_this_month(db, user.id),
        limit_usd=settings.plan_limit_usd(user.plan),
        plan=user.plan,
    )


class QuotaExceeded(Exception):
    """Raised when a user has used their monthly allowance."""

    def __init__(self, status: QuotaStatus):
        self.status = status
        super().__init__(
            f"You've used your ${status.limit_usd:.2f} of questions for this month. "
            f"It resets on the 1st."
        )


def enforce(db: Session, user: User) -> QuotaStatus:
    status = get_quota(db, user)
    if status.exhausted:
        raise QuotaExceeded(status)
    return status


@dataclass
class ContentStatus:
    """Indexed passages against the plan's allowance."""

    used_chunks: int
    limit_chunks: int

    @property
    def remaining_chunks(self) -> int:
        return max(0, self.limit_chunks - self.used_chunks)

    def to_dict(self) -> dict:
        return {
            "used_chunks": self.used_chunks,
            "limit_chunks": self.limit_chunks,
            "remaining_chunks": self.remaining_chunks,
            "percent_used": min(100, int(self.used_chunks / self.limit_chunks * 100))
            if self.limit_chunks > 0 else 100,
        }


def get_content_status(db: Session, user: User) -> ContentStatus:
    used = db.execute(
        select(func.count(Chunk.id)).where(Chunk.user_id == user.id)
    ).scalar_one()
    return ContentStatus(used_chunks=int(used), limit_chunks=settings.plan_max_chunks(user.plan))
