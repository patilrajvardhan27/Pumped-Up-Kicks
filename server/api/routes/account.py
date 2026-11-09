"""
Your data: download all of it, or delete the account and everything in it.

These back the rights the privacy policy describes (access, portability,
erasure) with buttons instead of an email to support.
"""
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import delete

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Conversation, User, Video
from api.services.lecture_rag_service import get_rag_service
from api.services.pipeline import purge_files
from api.services.ratelimit import rate_limit

router = APIRouter(prefix="/api/account", tags=["account"])

account_limit = rate_limit("account", settings.rate_limit_account_per_minute)


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _lecture(ctx: RequestContext, video: Video) -> dict:
    return {
        "id": video.id,
        "title": video.title or video.filename,
        "filename": video.filename,
        "uploaded_at": _iso(video.created_at),
        "duration_seconds": video.duration_s,
        "status": video.stage,
        "transcript": get_rag_service().transcript(ctx.db, ctx.user_id, video.id),
    }


def _conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "lecture_id": conversation.video_id,
        "created_at": _iso(conversation.created_at),
        "messages": [
            {"role": m.role, "content": m.content, "created_at": _iso(m.created_at),
             "cost_usd": float(m.cost_usd) if m.cost_usd is not None else None}
            for m in conversation.messages
        ],
    }


@router.get("/export", dependencies=[account_limit])
def export_data(ctx: RequestContext = Ctx):
    """Everything stored about this account, as one JSON file. Video files are not included."""
    user = ctx.user
    videos = ctx.db.query(Video).filter(Video.user_id == user.id).order_by(Video.created_at).all()
    conversations = (
        ctx.db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.created_at).all()
    )
    body = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "id": user.id, "email": user.email, "display_name": user.display_name,
            "plan": user.plan, "created_at": _iso(user.created_at),
        },
        "lectures": [_lecture(ctx, v) for v in videos],
        "conversations": [_conversation(c) for c in conversations],
    }
    return JSONResponse(
        body,
        headers={"Content-Disposition": 'attachment; filename="pumped-up-kicks-export.json"'},
    )


@router.delete("", dependencies=[account_limit])
def delete_account(ctx: RequestContext = Ctx):
    """
    Delete every lecture file and transcript, then the account row. Chunks,
    chats, citations and cached answers cascade from it in the database.

    Sign-in itself lives with the identity provider; the client deletes that
    account straight after this succeeds.
    """
    for video in ctx.db.query(Video).filter(Video.user_id == ctx.user_id).all():
        purge_files(video)
    ctx.db.execute(delete(User).where(User.id == ctx.user_id))
    ctx.db.commit()
    return {"message": "Your account and all of its data have been deleted."}
