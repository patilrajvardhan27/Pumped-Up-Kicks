"""
Study tools: a study guide per lecture, practice questions and flashcards per
subject, and upcoming deadlines from Canvas.

Guides and practice sets call Claude, so they check the monthly quota first,
are rate limited like chat, and record what each call cost (usage_charges),
whether or not its reply could be used.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Deadline, StudyGuide, StudySet, UsageCharge, Video
from api.routes.workspaces import owned_workspace
from api.services import study
from api.services.quota import QuotaExceeded, enforce
from api.services.ratelimit import rate_limit

router = APIRouter(tags=["study"])


# --- schemas ----------------------------------------------------------------


class KeyTerm(BaseModel):
    term: str
    definition: str
    start: Optional[float] = None


class OutlineEntry(BaseModel):
    start: float
    title: str


class StudyGuideInfo(BaseModel):
    video_id: int
    summary: str
    key_terms: List[KeyTerm]
    outline: List[OutlineEntry]
    covered_until_s: Optional[float] = None
    cost_usd: Optional[float] = None
    created_at: str


class StudyGuideResponse(BaseModel):
    """`guide` is null until one has been made."""
    guide: Optional[StudyGuideInfo] = None


class PracticeRequest(BaseModel):
    kind: Literal["questions", "flashcards"]
    count: int = Field(8, ge=3, le=20)
    # Optional topic to draw from; without one the set spreads across the subject.
    focus: Optional[str] = Field(None, max_length=200)


class StudySetInfo(BaseModel):
    id: int
    workspace_id: int
    kind: str
    focus: Optional[str] = None
    items: List[dict]
    cost_usd: Optional[float] = None
    created_at: str


class DeadlineInfo(BaseModel):
    id: int
    workspace_id: Optional[int] = None
    title: str
    due_at: str
    url: Optional[str] = None
    points_possible: Optional[float] = None
    is_quiz: bool


# --- helpers ----------------------------------------------------------------


def _charge(db: Session, user_id: str, purpose: str, usage: Optional[dict]) -> Optional[float]:
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


def _quota(ctx: RequestContext) -> None:
    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))


def _guide_info(guide: StudyGuide) -> StudyGuideInfo:
    return StudyGuideInfo(
        video_id=guide.video_id,
        summary=guide.summary,
        key_terms=json.loads(guide.key_terms),
        outline=json.loads(guide.outline),
        covered_until_s=guide.covered_until_s,
        cost_usd=float(guide.cost_usd) if guide.cost_usd is not None else None,
        created_at=guide.created_at.isoformat(),
    )


def _set_info(study_set: StudySet) -> StudySetInfo:
    return StudySetInfo(
        id=study_set.id,
        workspace_id=study_set.workspace_id,
        kind=study_set.kind,
        focus=study_set.focus,
        items=json.loads(study_set.items),
        cost_usd=float(study_set.cost_usd) if study_set.cost_usd is not None else None,
        created_at=study_set.created_at.isoformat(),
    )


def _owned_video(ctx: RequestContext, video_id: int) -> Video:
    video = (
        ctx.db.query(Video)
        .filter(Video.id == video_id, Video.user_id == ctx.user_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


def _stored_guide(ctx: RequestContext, video_id: int) -> Optional[StudyGuide]:
    return (
        ctx.db.query(StudyGuide)
        .filter(StudyGuide.video_id == video_id, StudyGuide.user_id == ctx.user_id)
        .first()
    )


# --- study guides -----------------------------------------------------------


@router.get("/api/videos/{video_id}/study-guide", response_model=StudyGuideResponse)
def get_study_guide(video_id: int, ctx: RequestContext = Ctx):
    _owned_video(ctx, video_id)
    guide = _stored_guide(ctx, video_id)
    return StudyGuideResponse(guide=_guide_info(guide) if guide else None)


@router.post(
    "/api/videos/{video_id}/study-guide",
    response_model=StudyGuideResponse,
    dependencies=[rate_limit("study", settings.rate_limit_chat_per_minute)],
)
def make_study_guide(video_id: int, ctx: RequestContext = Ctx):
    """Made once. Asking again returns the stored guide and costs nothing."""
    video = _owned_video(ctx, video_id)
    existing = _stored_guide(ctx, video_id)
    if existing:
        return StudyGuideResponse(guide=_guide_info(existing))
    if video.stage != "ready":
        raise HTTPException(status_code=409, detail="This lecture is still being processed.")
    _quota(ctx)

    try:
        guide, usage, covered_until = study.make_study_guide(ctx.db, video)
    except study.StudyError as e:
        _charge(ctx.db, ctx.user_id, "study_guide", getattr(e, "usage", None))
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
    _charge(ctx.db, ctx.user_id, "study_guide", usage)
    ctx.db.add(record)
    try:
        ctx.db.commit()
    except IntegrityError:
        # Another request made it first. Keep that one; this call is still charged.
        ctx.db.rollback()
        _charge(ctx.db, ctx.user_id, "study_guide", usage)
        ctx.db.commit()
        return StudyGuideResponse(guide=_guide_info(_stored_guide(ctx, video_id)))
    ctx.db.refresh(record)
    return StudyGuideResponse(guide=_guide_info(record))


# --- practice ---------------------------------------------------------------


@router.get("/api/workspaces/{workspace_id}/practice", response_model=List[StudySetInfo])
def list_practice(workspace_id: int, ctx: RequestContext = Ctx):
    owned_workspace(ctx, workspace_id)
    sets = (
        ctx.db.query(StudySet)
        .filter(StudySet.user_id == ctx.user_id, StudySet.workspace_id == workspace_id)
        .order_by(StudySet.created_at.desc(), StudySet.id.desc())
        .limit(20)
        .all()
    )
    return [_set_info(s) for s in sets]


@router.post(
    "/api/workspaces/{workspace_id}/practice",
    response_model=StudySetInfo,
    status_code=201,
    dependencies=[rate_limit("study", settings.rate_limit_chat_per_minute)],
)
def make_practice(workspace_id: int, request: PracticeRequest, ctx: RequestContext = Ctx):
    """Practice questions or flashcards from this subject's lectures and course material."""
    workspace = owned_workspace(ctx, workspace_id)
    _quota(ctx)
    focus = " ".join((request.focus or "").split()) or None

    try:
        items, usage = study.make_practice(
            ctx.db, ctx.user_id, workspace.id, request.kind, request.count, focus
        )
    except study.StudyError as e:
        _charge(ctx.db, ctx.user_id, "practice", getattr(e, "usage", None))
        ctx.db.commit()
        status = 409 if getattr(e, "usage", None) is None else 502
        raise HTTPException(status_code=status, detail=str(e))

    record = StudySet(
        user_id=ctx.user_id,
        workspace_id=workspace.id,
        kind=request.kind,
        focus=focus,
        items=json.dumps(items),
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cost_usd=usage.get("cost_usd"),
    )
    _charge(ctx.db, ctx.user_id, "practice", usage)
    ctx.db.add(record)
    ctx.db.commit()
    ctx.db.refresh(record)
    return _set_info(record)


@router.delete("/api/practice/{set_id}")
def delete_practice(set_id: int, ctx: RequestContext = Ctx):
    record = (
        ctx.db.query(StudySet)
        .filter(StudySet.id == set_id, StudySet.user_id == ctx.user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Practice set not found")
    ctx.db.delete(record)
    ctx.db.commit()
    return {"message": "Practice set deleted."}


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
