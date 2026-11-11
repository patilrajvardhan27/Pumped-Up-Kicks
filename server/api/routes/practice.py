"""Practice questions and flashcards for a subject: list, make and delete."""
import json
from typing import List

from fastapi import APIRouter, HTTPException

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import StudySet
from api.routes.workspaces import owned_workspace
from api.schemas.study import PracticeRequest, StudySetInfo
from api.services import practice, study
from api.services.ratelimit import rate_limit
from api.services.study_records import charge, quota, set_info

router = APIRouter(tags=["study"])


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
    return [set_info(s) for s in sets]


@router.post(
    "/api/workspaces/{workspace_id}/practice",
    response_model=StudySetInfo,
    status_code=201,
    dependencies=[rate_limit("study", settings.rate_limit_chat_per_minute)],
)
def make_practice(workspace_id: int, request: PracticeRequest, ctx: RequestContext = Ctx):
    """Practice questions or flashcards from this subject's lectures and course material."""
    workspace = owned_workspace(ctx, workspace_id)
    quota(ctx)
    focus = " ".join((request.focus or "").split()) or None

    try:
        items, usage = practice.make_practice(
            ctx.db, ctx.user_id, workspace.id, request.kind, request.count, focus
        )
    except study.StudyError as e:
        charge(ctx.db, ctx.user_id, "practice", getattr(e, "usage", None))
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
    charge(ctx.db, ctx.user_id, "practice", usage)
    ctx.db.add(record)
    ctx.db.commit()
    ctx.db.refresh(record)
    return set_info(record)


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
