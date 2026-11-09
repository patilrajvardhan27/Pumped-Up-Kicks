"""
One chat turn, end to end: find or open the thread, gather passages, serve a
cached answer or stream a fresh one, then save the question, the answer and
its citations.

A conversation belongs to one user and optionally one lecture. Every assistant
message records which chunks it cited, so citations survive a reload.
"""
import json
from typing import Dict, Iterator, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from api.errors import safe_detail
from api.models.database import AnswerCache, Conversation, Message, MessageSource, Video, get_session
from api.schemas.chat import ChatRequest, Source
from api.services.lecture_rag_service import get_rag_service, to_source
from api.services.study import tool_for


def sse(event: Dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def question_for(request: ChatRequest) -> str:
    """The text a turn is saved and cached under. Study tools use their label."""
    tool = tool_for(request.mode)
    if tool:
        return tool.label
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Type a question first.")
    return question


NEEDS_LECTURE = "Pick a lecture first: study tools work on one lecture at a time."


def resolve_conversation(db: Session, user_id: str, request: ChatRequest, question: str) -> Conversation:
    """Find the requested thread, or open a new one titled from the question.

    Everything is checked before a new thread is written, so a rejected request
    leaves no empty conversation behind.
    """
    needs_lecture = tool_for(request.mode) is not None

    if request.conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == request.conversation_id, Conversation.user_id == user_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if needs_lecture and conversation.video_id is None:
            raise HTTPException(status_code=422, detail=NEEDS_LECTURE)
        return conversation

    if needs_lecture and request.video_id is None:
        raise HTTPException(status_code=422, detail=NEEDS_LECTURE)
    if request.video_id is not None and not (
        db.query(Video).filter(Video.id == request.video_id, Video.user_id == user_id).first()
    ):
        raise HTTPException(status_code=404, detail="Video not found")

    conversation = Conversation(
        user_id=user_id,
        video_id=request.video_id,
        title=question[:80] + ("…" if len(question) > 80 else ""),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def source_models(message: Message) -> List[Source]:
    """Citations of a saved answer, rebuilt from the chunks they point at."""
    out = []
    for link in message.sources:
        chunk = link.chunk
        if chunk is None:
            continue
        video = chunk.video
        title = (video.title or video.filename) if video else "unknown"
        out.append(Source(**to_source(chunk, title, video.duration_s if video else None, link.similarity)))
    return out


def _persist(db: Session, conversation_id: int, question: str, done: Dict, cache_hit: bool) -> None:
    db.add(Message(conversation_id=conversation_id, role="user", content=question))
    usage = done.get("usage") or {}
    assistant = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=done["answer"],
        model=usage.get("model"),
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cost_usd=usage.get("cost_usd"),
        cache_hit=1 if cache_hit else 0,
        response_time_s=done.get("response_time"),
    )
    db.add(assistant)
    db.flush()
    for chunk_id in dict.fromkeys(s["chunk_id"] for s in done["sources"] if s.get("chunk_id")):
        similarity = next(s.get("similarity") for s in done["sources"] if s.get("chunk_id") == chunk_id)
        db.add(MessageSource(message_id=assistant.id, chunk_id=chunk_id, similarity=similarity))
    db.commit()


def _cached(db: Session, user_id: str, key: str, passages: List[Dict]) -> Optional[Dict]:
    row = db.query(AnswerCache).filter(AnswerCache.user_id == user_id, AnswerCache.cache_key == key).first()
    if row is None:
        return None
    row.hits += 1
    db.commit()
    cited = {item.get("chunk_id") for item in json.loads(row.sources_json or "[]")}
    sources = [p for p in passages if p["chunk_id"] in cited] or passages
    return {
        "type": "done", "answer": row.answer, "sources": sources, "num_sources": len(sources),
        "response_time": 0.0, "usage": {"model": row.model, "cost_usd": 0.0},
    }


def _store(db: Session, user_id: str, key: str, question: str, done: Dict) -> None:
    db.add(AnswerCache(
        user_id=user_id,
        cache_key=key,
        question=question,
        answer=done["answer"],
        sources_json=json.dumps([{"chunk_id": s.get("chunk_id")} for s in done["sources"]]),
        model=(done.get("usage") or {}).get("model"),
    ))
    db.commit()


def stream_turn(user_id: str, conversation: Conversation, request: ChatRequest, question: str) -> Iterator[str]:
    """
    The server-sent event stream for one turn. Opens its own session, because
    the request-scoped one closes as soon as the response starts.
    """
    rag = get_rag_service()
    conversation_id, video_id = conversation.id, conversation.video_id
    db = get_session()
    try:
        yield sse({"type": "conversation", "conversation_id": conversation_id})
        passages = rag.gather(db, user_id, question, request.mode, video_id, request.top_k)

        key = rag.cache_key(question, passages, rag.model_name, request.mode) if passages else None
        done = _cached(db, user_id, key, passages) if key else None
        cache_hit = done is not None

        if cache_hit:
            yield sse({"type": "sources", "sources": done["sources"]})
            yield sse({"type": "delta", "text": done["answer"]})
            yield sse(done)
        else:
            for event in rag.stream_answer(question, passages, request.mode):
                if event["type"] == "done":
                    done = event
                yield sse(event)

        if done is None:
            return  # the stream ended in an error event; nothing to save
        if key and not cache_hit and done["sources"] and not done.get("not_covered"):
            _store(db, user_id, key, question, done)
        _persist(db, conversation_id, question, done, cache_hit)
    except Exception as e:
        db.rollback()
        yield sse({"type": "error", "message": safe_detail(e, "chat stream")})
    finally:
        db.close()

