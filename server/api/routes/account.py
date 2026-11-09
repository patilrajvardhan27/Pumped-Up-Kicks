"""
Your data: read a lecture's transcript, download everything, or delete the
account and all of it. These back the rights the privacy policy describes
(access, portability, erasure) with buttons instead of an email to support.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import delete

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import (
    CanvasConnection, Conversation, Deadline, Document, StudyGuide, StudySet, User, Video, Workspace,
)
from api.services.cleanup import purge_video_files, revoke_canvas
from api.services.ratelimit import rate_limit
from api.services.study import lecture_lines

router = APIRouter(tags=["account"])

account_limit = rate_limit("account", settings.rate_limit_account_per_minute)


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _lines(ctx: RequestContext, video: Video) -> list[dict]:
    return [{"start": s, "end": e, "text": t} for s, e, t in lecture_lines(ctx.db, video)]


def _json(text: str):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return text


def _owned(ctx: RequestContext, model, *order):
    return ctx.db.query(model).filter(model.user_id == ctx.user_id).order_by(*order).all()


@router.get("/api/videos/{video_id}/transcript")
def get_transcript(video_id: int, ctx: RequestContext = Ctx):
    """The lecture as readable text with timestamps. Costs no AI tokens."""
    video = ctx.db.query(Video).filter(Video.id == video_id, Video.user_id == ctx.user_id).first()
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"video_id": video.id, "title": video.title or video.filename, "lines": _lines(ctx, video)}


@router.get("/api/account/export", dependencies=[account_limit])
def export_data(ctx: RequestContext = Ctx):
    """Everything stored about this account, as one JSON file. Video files are not included."""
    user = ctx.user
    body = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {"id": user.id, "email": user.email, "display_name": user.display_name,
                    "plan": user.plan, "created_at": _iso(user.created_at)},
        "subjects": [{"id": w.id, "name": w.name} for w in _owned(ctx, Workspace, Workspace.id)],
        "lectures": [
            {"id": v.id, "title": v.title or v.filename, "filename": v.filename, "subject_id": v.workspace_id,
             "uploaded_at": _iso(v.created_at), "duration_seconds": v.duration_s, "transcript": _lines(ctx, v)}
            for v in _owned(ctx, Video, Video.created_at)
        ],
        "documents": [
            {"id": d.id, "title": d.title, "source": d.source, "subject_id": d.workspace_id}
            for d in _owned(ctx, Document, Document.id)
        ],
        "conversations": [
            {"id": c.id, "title": c.title, "created_at": _iso(c.created_at),
             "messages": [{"role": m.role, "content": m.content, "created_at": _iso(m.created_at)}
                          for m in c.messages]}
            for c in _owned(ctx, Conversation, Conversation.created_at)
        ],
        "study_guides": [
            {"lecture_id": g.video_id, "summary": g.summary, "key_terms": _json(g.key_terms), "outline": _json(g.outline)}
            for g in _owned(ctx, StudyGuide, StudyGuide.id)
        ],
        "practice_sets": [
            {"id": s.id, "kind": s.kind, "focus": s.focus, "items": _json(s.items)}
            for s in _owned(ctx, StudySet, StudySet.id)
        ],
        "deadlines": [{"title": d.title, "due_at": _iso(d.due_at)} for d in _owned(ctx, Deadline, Deadline.id)],
    }
    return JSONResponse(body, headers={"Content-Disposition": 'attachment; filename="pumped-up-kicks-export.json"'})


@router.delete("/api/account", dependencies=[account_limit])
def delete_account(ctx: RequestContext = Ctx):
    """
    Delete every lecture file and transcript, revoke Canvas access, then the
    account row; everything else cascades from it in the database. Sign-in
    lives with the identity provider; the client deletes that account next.
    """
    for video in _owned(ctx, Video, Video.id):
        purge_video_files(video)
    connection = ctx.db.query(CanvasConnection).filter(CanvasConnection.user_id == ctx.user_id).first()
    if connection is not None:
        revoke_canvas(connection)
    ctx.db.execute(delete(User).where(User.id == ctx.user_id))
    ctx.db.commit()
    return {"message": "Your account and all of its data have been deleted."}
