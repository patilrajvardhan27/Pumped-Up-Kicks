"""Chat: ask a question or run a study tool, and manage saved threads."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func

from api.config import settings
from api.deps import Ctx, RequestContext, owned
from api.models.database import Conversation, Message, Video
from api.schemas.chat import ChatRequest, ConversationDetail, ConversationItem, MessageItem, UsageSummary
from api.services.quota import QuotaExceeded, enforce, get_quota
from api.services.ratelimit import rate_limit
from api.services.turns import question_for, resolve_conversation, source_models, stream_turn

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _item(conversation: Conversation, video_title: Optional[str], count: int) -> dict:
    return dict(
        id=conversation.id,
        title=conversation.title,
        video_id=conversation.video_id,
        video_title=video_title,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        message_count=count,
    )


@router.post("/stream", dependencies=[rate_limit("chat", settings.rate_limit_chat_per_minute)])
def chat_stream(request: ChatRequest, ctx: RequestContext = Ctx):
    """Server-sent events: conversation, sources, deltas, then done (or error)."""
    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    question = question_for(request)
    conversation = resolve_conversation(ctx.db, ctx.user_id, request, question)

    return StreamingResponse(
        stream_turn(ctx.user_id, conversation, request, question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/conversations", response_model=List[ConversationItem])
def list_conversations(
    video_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Ctx,
):
    """Threads for this user, optionally only those about one lecture."""
    counts = (
        ctx.db.query(Message.conversation_id, func.count(Message.id))
        .group_by(Message.conversation_id)
        .subquery()
    )
    query = (
        ctx.db.query(Conversation, func.coalesce(Video.title, Video.filename), func.coalesce(counts.c[1], 0))
        .outerjoin(Video, (Video.id == Conversation.video_id) & (Video.user_id == ctx.user_id))
        .outerjoin(counts, counts.c.conversation_id == Conversation.id)
        .filter(Conversation.user_id == ctx.user_id)
    )
    if video_id is not None:
        query = query.filter(Conversation.video_id == video_id)

    rows = query.order_by(Conversation.updated_at.desc()).limit(limit).all()
    return [ConversationItem(**_item(c, title, count)) for c, title, count in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, ctx: RequestContext = Ctx):
    """Full thread, with the citations behind each answer."""
    conversation = owned(ctx, Conversation, conversation_id, "Conversation")
    video = owned(ctx, Video, conversation.video_id, "Video") if conversation.video_id else None

    return ConversationDetail(
        **_item(conversation, (video.title or video.filename) if video else None, len(conversation.messages)),
        messages=[
            MessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
                sources=source_models(m) if m.role == "assistant" else [],
                cost_usd=float(m.cost_usd) if m.cost_usd is not None else None,
                cache_hit=bool(m.cache_hit),
            )
            for m in conversation.messages
        ],
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, ctx: RequestContext = Ctx):
    ctx.db.delete(owned(ctx, Conversation, conversation_id, "Conversation"))
    ctx.db.commit()
    return {"message": "Conversation deleted."}


@router.get("/usage", response_model=UsageSummary)
def get_usage(ctx: RequestContext = Ctx):
    """This user's questions and where they sit against their monthly allowance."""
    asked, hits, cost = (
        ctx.db.query(
            func.count(Message.id),
            func.coalesce(func.sum(Message.cache_hit), 0),
            func.coalesce(func.sum(Message.cost_usd), 0),
        )
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(Conversation.user_id == ctx.user_id, Message.role == "assistant")
        .one()
    )
    return UsageSummary(
        questions_asked=asked,
        cache_hits=int(hits),
        total_cost_usd=round(float(cost), 4),
        quota=get_quota(ctx.db, ctx.user).to_dict(),
    )
