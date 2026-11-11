"""
Charging generated study material to the usage ledger, and turning stored guides and
sets into responses.
"""
import json
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from api.deps import RequestContext
from api.models.database import StudyGuide, StudySet, UsageCharge
from api.schemas.study import StudyGuideInfo, StudySetInfo
from api.services.quota import QuotaExceeded, enforce

# --- helpers ----------------------------------------------------------------


def charge(db: Session, user_id: str, purpose: str, usage: Optional[dict]) -> Optional[float]:
    """Record a call's cost. Committed by the caller."""
    if not usage:
        return None
    cost = float(usage.get("cost_usd") or 0)
    db.add(UsageCharge(
        user_id=user_id,
        purpose=purpose,
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cost_usd=cost,
    ))
    return cost


def quota(ctx: RequestContext) -> None:
    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))


def guide_info(guide: StudyGuide) -> StudyGuideInfo:
    return StudyGuideInfo(
        video_id=guide.video_id,
        summary=guide.summary,
        key_terms=json.loads(guide.key_terms),
        outline=json.loads(guide.outline),
        covered_until_s=guide.covered_until_s,
        cost_usd=float(guide.cost_usd) if guide.cost_usd is not None else None,
        created_at=guide.created_at.isoformat(),
    )


def set_info(study_set: StudySet) -> StudySetInfo:
    return StudySetInfo(
        id=study_set.id,
        workspace_id=study_set.workspace_id,
        kind=study_set.kind,
        focus=study_set.focus,
        items=json.loads(study_set.items),
        cost_usd=float(study_set.cost_usd) if study_set.cost_usd is not None else None,
        created_at=study_set.created_at.isoformat(),
    )


def stored_guide(ctx: RequestContext, video_id: int) -> Optional[StudyGuide]:
    return (
        ctx.db.query(StudyGuide)
        .filter(StudyGuide.video_id == video_id, StudyGuide.user_id == ctx.user_id)
        .first()
    )
