"""
Chat over a user's lectures.

A conversation belongs to one user and searches one lecture, one subject, the
Unsorted lectures, or everything (see api/services/scope.py); messages hang off
it, and every assistant message records which chunks it cited so the citation
strip survives a reload.
"""
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import (
    Conversation,
    Message,
    get_session,
)
from api.schemas.chat import (
    ChatRequest,
    ChatResponse,
    Source,
    Usage,
    UsageSummary,
)
from api.services.errors import public_message
from api.services.lecture_rag_service import get_rag_service
from api.services.quota import QuotaExceeded, enforce, get_content_status, get_quota
from api.services.ratelimit import rate_limit
from api.services.scope import ChatScope
from api.services.turns import (
    cache_lookup,
    cache_store,
    persist_turn,
    resolve_conversation,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post(
    "/query",
    response_model=ChatResponse,
    dependencies=[rate_limit("chat", settings.rate_limit_chat_per_minute)],
)
def chat_query(request: ChatRequest, ctx: RequestContext = Ctx):
    rag = get_rag_service()

    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    conversation = resolve_conversation(ctx, request)
    scope = ChatScope.of(conversation)

    sources = rag.retrieve(
        ctx.db, ctx.user_id, request.question, scope=scope, top_k=request.top_k,
    )

    cache_hit = False
    key = None

    if sources:
        key = rag.cache_key(request.question, sources, rag.model_name, scope)
        cached = cache_lookup(ctx.db, ctx.user_id, key)
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
            ctx.db, ctx.user_id, request.question, scope=scope, top_k=request.top_k,
        )
        if key and not result.get("error") and not result.get("not_covered"):
            cache_store(ctx.db, ctx.user_id, key, request.question, result)

    assistant = persist_turn(ctx.db, conversation, request.question, result, cache_hit)

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


@router.post("/stream", dependencies=[rate_limit("chat", settings.rate_limit_chat_per_minute)])
def chat_stream(request: ChatRequest, ctx: RequestContext = Ctx):
    """Server-sent events: sources, then deltas, then done (or error)."""
    rag = get_rag_service()

    try:
        enforce(ctx.db, ctx.user)
    except QuotaExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))

    conversation = resolve_conversation(ctx, request)
    conversation_id = conversation.id
    scope = ChatScope.of(conversation)
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

            for event in rag.stream_answer(db, user_id, question, scope=scope, top_k=top_k):
                if event["type"] == "sources":
                    sources = event["sources"]
                elif event["type"] == "done":
                    answer = event["answer"]
                    usage = event.get("usage", {})
                    response_time = event.get("response_time", 0.0)
                    # A not-covered answer ends with no sources, so none are saved or cached.
                    sources = event.get("sources", sources)
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
                    key = rag.cache_key(question, sources, rag.model_name, scope)
                    cache_store(db, user_id, key, question, result)
                persist_turn(db, conversation, question, result, cache_hit=False)

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': public_message(e, 'Something went wrong while answering. Try again.')})}\n\n"
        finally:
            db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
        content=get_content_status(ctx.db, ctx.user).to_dict(),
    )
