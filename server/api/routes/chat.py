"""
Per-video chat.

A conversation belongs to one user and optionally to one lecture; messages hang
off it, and every assistant message records which chunks it cited so the
citation strip survives a reload.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import (
    AnswerCache,
    Conversation,
    Message,
    MessageSource,
    Video,
    get_session,
)
from api.services.lecture_rag_service import get_rag_service
from api.services.quota import QuotaExceeded, enforce, get_quota

router = APIRouter(prefix="/api/chat", tags=["chat"])


# --- schemas ----------------------------------------------------------------


class Source(BaseModel):
    chunk_id: Optional[int] = None
    video_id: Optional[int] = None
    text: str
    timestamp: str
    video: str
    start: Optional[float] = None
    end: Optional[float] = None
    similarity: Optional[float] = None
    video_duration: Optional[float] = None


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    model: str = ""
    cost_usd: float = 0.0


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    conversation_id: Optional[int] = None
    video_id: Optional[int] = None
    top_k: Optional[int] = Field(None, ge=1, le=20)


class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int
    answer: str
    sources: List[Source]
    response_time: float
    num_sources: int
    usage: Optional[Usage] = None
    cache_hit: bool = False


class MessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
    sources: List[Source] = []
    cost_usd: Optional[float] = None
    cache_hit: bool = False


class ConversationItem(BaseModel):
    id: int
    title: Optional[str]
    video_id: Optional[int]
    video_title: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(ConversationItem):
    messages: List[MessageItem] = []


class HealthResponse(BaseModel):
    status: str
    documents_indexed: int
    embedding_model: str
    llm_model: str
    vector_store: str


class UsageSummary(BaseModel):
    questions_asked: int
    cache_hits: int
    total_cost_usd: float
    total_input_tokens: int
    total_output_tokens: int
    model: str
    quota: dict


# --- helpers ----------------------------------------------------------------


def _owned_conversation(ctx: RequestContext, conversation_id: int) -> Conversation:
    conversation = (
        ctx.db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == ctx.user_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _resolve_conversation(
    db: Session, user_id: str, conversation_id: Optional[int],
    video_id: Optional[int], question: str,
) -> Conversation:
    """Find the requested thread, or open a new one titled from the question."""
    if conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation

    if video_id is not None:
        owns = (
            db.query(Video)
            .filter(Video.id == video_id, Video.user_id == user_id)
            .first()
        )
        if not owns:
            raise HTTPException(status_code=404, detail="Video not found")

    title = question.strip()
    conversation = Conversation(
        user_id=user_id,
        video_id=video_id,
        title=title[:80] + ("…" if len(title) > 80 else ""),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def _source_models(message: Message) -> List[Source]:
    from api.services.lecture_rag_service import format_timestamp

    out = []
    for link in message.sources:
        chunk = link.chunk
        if chunk is None:
            continue
        video = chunk.video
        out.append(Source(
            chunk_id=chunk.id,
            video_id=chunk.video_id,
            text=chunk.text,
            timestamp=f"{format_timestamp(chunk.start_s)} - {format_timestamp(chunk.end_s)}",
            video=(video.title or video.filename) if video else "unknown",
            start=chunk.start_s,
            end=chunk.end_s,
            similarity=link.similarity,
            video_duration=video.duration_s if video else None,
        ))
    return out


def _persist_turn(
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
    for source in result.get("sources", []):
        chunk_id = source.get("chunk_id")
        if chunk_id is None or chunk_id in seen:
            continue
        seen.add(chunk_id)
        db.add(MessageSource(
            message_id=assistant.id,
            chunk_id=chunk_id,
            similarity=source.get("similarity"),
        ))

    db.commit()
    return assistant


def _cache_lookup(db: Session, user_id: str, key: str) -> Optional[AnswerCache]:
    return (
        db.query(AnswerCache)
        .filter(AnswerCache.user_id == user_id, AnswerCache.cache_key == key)
        .first()
    )


def _cache_store(db: Session, user_id: str, key: str, question: str, result: dict) -> None:
    if result.get("error") or _cache_lookup(db, user_id, key):
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


# --- routes -----------------------------------------------------------------


@router.post("/query", response_model=ChatResponse)
def chat_query(request: ChatRequest, ctx: RequestContext = Ctx):
    rag = get_rag_service()

    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    conversation = _resolve_conversation(
        ctx.db, ctx.user_id, request.conversation_id, request.video_id, request.question
    )

    sources = rag.retrieve(
        ctx.db, ctx.user_id, request.question,
        video_id=conversation.video_id, top_k=request.top_k,
    )

    cache_hit = False
    key = None

    if sources:
        key = rag.cache_key(request.question, sources, rag.model_name)
        cached = _cache_lookup(ctx.db, ctx.user_id, key)
        if cached:
            cached.hits += 1
            ctx.db.commit()
            result = {
                "answer": cached.answer,
                "sources": sources,
                "response_time": 0.0,
                "num_sources": len(sources),
                "usage": {"model": cached.model or rag.model_name, "cost_usd": 0.0},
            }
            cache_hit = True

    if not cache_hit:
        result = rag.answer(
            ctx.db, ctx.user_id, request.question,
            video_id=conversation.video_id, top_k=request.top_k,
        )
        if key and not result.get("error"):
            _cache_store(ctx.db, ctx.user_id, key, request.question, result)

    assistant = _persist_turn(ctx.db, conversation, request.question, result, cache_hit)

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant.id,
        answer=result["answer"],
        sources=[Source(**s) for s in result["sources"]],
        response_time=result["response_time"],
        num_sources=result["num_sources"],
        usage=Usage(**result["usage"]) if result.get("usage") else None,
        cache_hit=cache_hit,
    )


@router.post("/stream")
def chat_stream(request: ChatRequest, ctx: RequestContext = Ctx):
    """Server-sent events: sources, then deltas, then done (or error)."""
    rag = get_rag_service()

    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    conversation = _resolve_conversation(
        ctx.db, ctx.user_id, request.conversation_id, request.video_id, request.question
    )
    conversation_id = conversation.id
    conversation_video_id = conversation.video_id
    user_id = ctx.user_id
    question = request.question
    top_k = request.top_k

    def event_stream():
        # The request-scoped session closes when the response starts, so the
        # generator opens its own.
        db = get_session()
        try:
            answer, usage, sources, response_time = "", {}, [], 0.0

            first = {"type": "conversation", "conversation_id": conversation_id}
            yield f"data: {json.dumps(first)}\n\n"

            for event in rag.stream_answer(
                db, user_id, question, video_id=conversation_video_id, top_k=top_k
            ):
                if event["type"] == "sources":
                    sources = event["sources"]
                elif event["type"] == "done":
                    answer = event["answer"]
                    usage = event.get("usage", {})
                    response_time = event.get("response_time", 0.0)
                yield f"data: {json.dumps(event)}\n\n"

            if answer:
                conversation = db.get(Conversation, conversation_id)
                result = {
                    "answer": answer,
                    "sources": sources,
                    "response_time": response_time,
                    "num_sources": len(sources),
                    "usage": usage,
                }
                if sources:
                    key = rag.cache_key(question, sources, rag.model_name)
                    _cache_store(db, user_id, key, question, result)
                _persist_turn(db, conversation, question, result, cache_hit=False)

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/conversations", response_model=List[ConversationItem])
def list_conversations(
    video_id: Optional[int] = None, limit: int = 50, ctx: RequestContext = Ctx
):
    """Threads for this user, optionally only those about one lecture."""
    query = ctx.db.query(Conversation).filter(Conversation.user_id == ctx.user_id)
    if video_id is not None:
        query = query.filter(Conversation.video_id == video_id)

    conversations = query.order_by(Conversation.updated_at.desc()).limit(limit).all()

    video_titles = {
        v.id: (v.title or v.filename)
        for v in ctx.db.query(Video).filter(Video.user_id == ctx.user_id).all()
    }

    return [
        ConversationItem(
            id=c.id,
            title=c.title,
            video_id=c.video_id,
            video_title=video_titles.get(c.video_id),
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
            message_count=len(c.messages),
        )
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, ctx: RequestContext = Ctx):
    """Full thread, with the citations behind each answer."""
    conversation = _owned_conversation(ctx, conversation_id)

    video_title = None
    if conversation.video_id:
        video = ctx.db.get(Video, conversation.video_id)
        video_title = (video.title or video.filename) if video else None

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        video_id=conversation.video_id,
        video_title=video_title,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        message_count=len(conversation.messages),
        messages=[
            MessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
                sources=_source_models(m) if m.role == "assistant" else [],
                cost_usd=float(m.cost_usd) if m.cost_usd is not None else None,
                cache_hit=bool(m.cache_hit),
            )
            for m in conversation.messages
        ],
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, ctx: RequestContext = Ctx):
    conversation = _owned_conversation(ctx, conversation_id)
    ctx.db.delete(conversation)
    ctx.db.commit()
    return {"message": "Conversation deleted."}


@router.get("/usage", response_model=UsageSummary)
def get_usage(ctx: RequestContext = Ctx):
    """This user's spend and where they sit against their monthly allowance."""
    messages = (
        ctx.db.query(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(Conversation.user_id == ctx.user_id, Message.role == "assistant")
        .all()
    )

    return UsageSummary(
        questions_asked=len(messages),
        cache_hits=sum(1 for m in messages if m.cache_hit),
        total_cost_usd=round(sum(float(m.cost_usd or 0) for m in messages), 4),
        total_input_tokens=sum(m.input_tokens or 0 for m in messages),
        total_output_tokens=sum(m.output_tokens or 0 for m in messages),
        model=settings.puk_claude_model,
        quota=get_quota(ctx.db, ctx.user).to_dict(),
    )


@router.get("/health", response_model=HealthResponse)
def health_check(ctx: RequestContext = Ctx):
    return HealthResponse(**get_rag_service().stats(ctx.db, ctx.user_id))
