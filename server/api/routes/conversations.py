"""Saved chat threads: list them, open one with its citations, or delete it."""
from typing import List, Optional

from fastapi import APIRouter, Query

from api.deps import Ctx, RequestContext
from api.models.database import (
    Conversation,
    Video,
)
from api.schemas.chat import (
    ConversationDetail,
    ConversationItem,
    MessageItem,
)
from api.services.turns import (
    conversation_item,
    owned_conversation,
    source_models,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/conversations", response_model=List[ConversationItem])
def list_conversations(
    video_id: Optional[int] = None,
    workspace_id: Optional[int] = None,
    unsorted: bool = False,
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Ctx,
):
    """
    Threads for this user. Optionally only those about one lecture, those filed
    under one subject, or (unsorted=true) those filed under no subject. Threads
    across every lecture are filed under no subject but are not Unsorted.
    """
    query = ctx.db.query(Conversation).filter(Conversation.user_id == ctx.user_id)
    if video_id is not None:
        query = query.filter(Conversation.video_id == video_id)
    if workspace_id is not None:
        query = query.filter(Conversation.workspace_id == workspace_id)
    elif unsorted:
        query = query.filter(Conversation.workspace_id.is_(None), Conversation.scope != "all")

    conversations = query.order_by(Conversation.updated_at.desc()).limit(limit).all()

    video_titles = {
        v.id: (v.title or v.filename)
        for v in ctx.db.query(Video).filter(Video.user_id == ctx.user_id).all()
    }

    return [
        ConversationItem(**conversation_item(c, video_titles.get(c.video_id)))
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, ctx: RequestContext = Ctx):
    """Full thread, with the citations behind each answer."""
    conversation = owned_conversation(ctx, conversation_id)

    video_title = None
    if conversation.video_id:
        video = ctx.db.get(Video, conversation.video_id)
        video_title = (video.title or video.filename) if video else None

    return ConversationDetail(
        **conversation_item(conversation, video_title),
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
    conversation = owned_conversation(ctx, conversation_id)
    ctx.db.delete(conversation)
    ctx.db.commit()
    return {"message": "Conversation deleted."}
