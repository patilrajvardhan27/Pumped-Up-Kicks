"""
Study tools: a study guide per lecture, practice questions and flashcards per
subject, and upcoming deadlines from Canvas.

Guides and practice sets call Claude, so they check the monthly quota first,
are rate limited like chat, and record what each call cost (usage_charges),
whether or not its reply could be used.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Deadline, StudyGuide
from api.schemas.study import DeadlineInfo, StudyGuideResponse
from api.services import study
from api.services.ratelimit import rate_limit
from api.services.study_records import charge, guide_info, quota, stored_guide
from api.services.uploads import owned_video

router = APIRouter(tags=["study"])


# --- study guides -----------------------------------------------------------


@router.get("/api/videos/{video_id}/study-guide", response_model=StudyGuideResponse)
def get_study_guide(video_id: int, ctx: RequestContext = Ctx):
    owned_video(ctx, video_id)
    guide = stored_guide(ctx, video_id)
    return StudyGuideResponse(guide=guide_info(guide) if guide else None)


@router.post(
    "/api/videos/{video_id}/study-guide",
    response_model=StudyGuideResponse,
    dependencies=[rate_limit("study", settings.rate_limit_chat_per_minute)],
)
def make_study_guide(video_id: int, ctx: RequestContext = Ctx):
    """Made once. Asking again returns the stored guide and costs nothing."""
    video = owned_video(ctx, video_id)
    existing = stored_guide(ctx, video_id)
    if existing:
        return StudyGuideResponse(guide=guide_info(existing))
    if video.stage != "ready":
        raise HTTPException(status_code=409, detail="This lecture is still being processed.")
    quota(ctx)

    try:
        guide, usage, covered_until = study.make_study_guide(ctx.db, video)
    except study.StudyError as e:
        charge(ctx.db, ctx.user_id, "study_guide", getattr(e, "usage", None))
        ctx.db.commit()
        raise HTTPException(status_code=502, detail=str(e))

    record = StudyGuide(
        user_id=ctx.user_id,
        video_id=video.id,
        summary=guide["summary"],
        key_terms=json.dumps(guide["key_terms"]),
        outline=json.dumps(guide["outline"]),
        covered_until_s=covered_until,
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cost_usd=usage.get("cost_usd"),
    )
    charge(ctx.db, ctx.user_id, "study_guide", usage)
    ctx.db.add(record)
    try:
        ctx.db.commit()
    except IntegrityError:
        # Another request made it first. Keep that one; this call is still charged.
        ctx.db.rollback()
        charge(ctx.db, ctx.user_id, "study_guide", usage)
        ctx.db.commit()
        return StudyGuideResponse(guide=guide_info(stored_guide(ctx, video_id)))
    ctx.db.refresh(record)
    return StudyGuideResponse(guide=guide_info(record))


# --- deadlines --------------------------------------------------------------


@router.get("/api/deadlines", response_model=List[DeadlineInfo])
def upcoming_deadlines(
    workspace_id: Optional[int] = None,
    days: int = 60,
    ctx: RequestContext = Ctx,
):
    """Canvas assignments due from now until `days` ahead, soonest first."""
    now = datetime.now(timezone.utc)
    query = ctx.db.query(Deadline).filter(
        Deadline.user_id == ctx.user_id,
        Deadline.due_at >= now,
        Deadline.due_at <= now + timedelta(days=max(1, min(days, 365))),
    )
    if workspace_id is not None:
        query = query.filter(Deadline.workspace_id == workspace_id)
    deadlines = query.order_by(Deadline.due_at, Deadline.id).limit(200).all()
    return [
        DeadlineInfo(
            id=d.id,
            workspace_id=d.workspace_id,
            title=d.title,
            due_at=d.due_at.isoformat(),
            url=d.url,
            points_possible=d.points_possible,
            is_quiz=d.is_quiz,
        )
        for d in deadlines
    ]
