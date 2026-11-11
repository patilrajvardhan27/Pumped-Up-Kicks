"""
One chat turn: find or open the thread, save the question and answer with their
citations, and the per-user answer cache.
"""
import json
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from api.deps import RequestContext
from api.models.database import (
    AnswerCache,
    Conversation,
    Message,
    MessageSource,
    Video,
)
from api.routes.workspaces import owned_workspace
from api.schemas.chat import ChatRequest, Source


def owned_conversation(ctx: RequestContext, conversation_id: int) -> Conversation:
    conversation = (
        ctx.db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == ctx.user_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def resolve_conversation(ctx: RequestContext, request: ChatRequest) -> Conversation:
    """Find the requested thread, or open a new one titled from the question."""
    db, user_id = ctx.db, ctx.user_id

    if request.conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == request.conversation_id, Conversation.user_id == user_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation

    scope = request.scope or ("video" if request.video_id is not None else "all")
    title = request.question.strip()
    conversation = Conversation(
        user_id=user_id,
        scope=scope,
        title=title[:80] + ("…" if len(title) > 80 else ""),
    )

    if scope == "video":
        if request.video_id is None:
            raise HTTPException(status_code=400, detail="Pick a lecture to ask about.")
        video = (
            db.query(Video)
            .filter(Video.id == request.video_id, Video.user_id == user_id)
            .first()
        )
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        # Filed with its lecture, so it shows under that lecture's subject.
        conversation.video_id = video.id
        conversation.workspace_id = video.workspace_id
    elif scope == "workspace" and request.workspace_id is not None:
        conversation.workspace_id = owned_workspace(ctx, request.workspace_id).id

    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def conversation_item(conversation: Conversation, video_title: Optional[str]) -> dict:
    return dict(
        id=conversation.id,
        title=conversation.title,
        scope=conversation.scope,
        video_id=conversation.video_id,
        workspace_id=conversation.workspace_id,
        video_title=video_title,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        message_count=len(conversation.messages),
    )


def source_models(message: Message) -> List[Source]:
    """
    The citations behind a stored answer, in the order they were given to the
    model, so a [Doc 3] in the answer still points at the third passage.
    """
    from api.services.sources import document_source, video_source

    out = []
    ordered = sorted(message.sources, key=lambda link: link.position or 0)
    for index, link in enumerate(ordered, start=1):
        chunk = link.chunk
        if chunk is None:
            continue
        if chunk.document is not None:
            source = document_source(chunk, chunk.document, ref=f"Doc {link.position or index}")
        elif chunk.video is not None:
            video = chunk.video
            source = video_source(chunk, video.filename, video.title, video.duration_s)
        else:
            continue
        source["similarity"] = link.similarity
        out.append(Source(**source))
    return out


def persist_turn(
    db: Session, conversation: Conversation, question: str, result: dict, cache_hit: bool
) -> Message:
    """Write the user's question and the assistant's answer, with citations."""
    db.add(Message(conversation_id=conversation.id, role="user", content=question))

    usage = result.get("usage") or {}
    assistant = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result["answer"],
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cost_usd=usage.get("cost_usd"),
        cache_hit=1 if cache_hit else 0,
        response_time_s=result.get("response_time"),
    )
    db.add(assistant)
    db.commit()
    db.refresh(assistant)

    seen = set()
    for position, source in enumerate(result.get("sources", []), start=1):
        chunk_id = source.get("chunk_id")
        if chunk_id is None or chunk_id in seen:
            continue
        seen.add(chunk_id)
        db.add(MessageSource(
            message_id=assistant.id,
            chunk_id=chunk_id,
            similarity=source.get("similarity"),
            position=position,
        ))

    db.commit()
    return assistant


def cache_lookup(db: Session, user_id: str, key: str) -> Optional[AnswerCache]:
    return (
        db.query(AnswerCache)
        .filter(AnswerCache.user_id == user_id, AnswerCache.cache_key == key)
        .first()
    )


def cache_store(db: Session, user_id: str, key: str, question: str, result: dict) -> None:
    if result.get("error") or cache_lookup(db, user_id, key):
        return
    db.add(AnswerCache(
        user_id=user_id,
        cache_key=key,
        question=question,
        answer=result["answer"],
        sources_json=json.dumps(
            [{"chunk_id": s.get("chunk_id"), "similarity": s.get("similarity")}
             for s in result.get("sources", [])]
        ),
        model=(result.get("usage") or {}).get("model"),
    ))
    db.commit()
