"""
Lecture Q&A: gather passages of a user's own lectures, then let Claude answer
using only those.

The whole multi-tenancy story is the `where Chunk.user_id == user_id` below:
one user can never read another's lecture, and the filter is applied inside the
vector search rather than after it.
"""
import hashlib
import sys
import time
from pathlib import Path
from typing import Dict, Iterator, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

SERVER_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(SERVER_DIR / "src"))

from services.embeddings.embedder import get_embedder  # noqa: E402
from services.llm.claude_client import ClaudeUsage, describe_api_error, get_claude_client  # noqa: E402

from api.config import settings  # noqa: E402
from api.errors import safe_detail  # noqa: E402
from api.models.database import Chunk, Video  # noqa: E402
from api.services.coverage import MESSAGE as NOT_COVERED_MESSAGE  # noqa: E402
from api.services.coverage import PROMPT_VERSION, CoverageGate, is_not_covered  # noqa: E402
from api.services.study import cited_sources, tool_for, transcript_lines  # noqa: E402

SYSTEM_PROMPT = """You are a teaching assistant for a student reviewing their own recorded lectures.

You answer only from the lecture excerpts you are given. Each excerpt is labelled with a timestamp and the video it came from.

Rules:
- Ground every claim in the excerpts.
- If the excerpts have nothing to do with the question, reply with exactly NOT_COVERED and nothing else. Do not say what the excerpts cover instead.
- If they cover only part of the question, answer that part and say plainly which part the lectures do not address. Do not describe unrelated material.
- Cite the timestamp in square brackets right after the claim it supports, like [12:04].
- If the lecture gives several reasons, limitations, or examples, list all of them.
- Prefer the lecturer's own terminology over synonyms.
- Be direct and concise. No preamble, no restating the question."""

EMPTY_ANSWER = (
    "No lecture content is indexed yet. Upload a video and wait for it to "
    "finish processing, then ask again."
)
CLAUDE_UNAVAILABLE = "The answer service is busy or unavailable. Try again in a moment."


def format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    h, m, s = total // 3600, (total % 3600) // 60, total % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def to_source(chunk: Chunk, title: str, duration: Optional[float], similarity: Optional[float] = None) -> Dict:
    """The one shape a passage takes on its way to the client."""
    return {
        "chunk_id": chunk.id,
        "video_id": chunk.video_id,
        "text": chunk.text,
        "start": chunk.start_s,
        "end": chunk.end_s,
        "timestamp": f"{format_timestamp(chunk.start_s)} - {format_timestamp(chunk.end_s)}",
        "video": title,
        "video_duration": duration,
        "similarity": similarity,
    }


class LectureRAGService:
    """Stateless. Every method takes the session and the owning user."""

    def __init__(self):
        self.model_name = settings.puk_claude_model
        self.embedding_model = settings.embedding_model

    # -- gathering passages ------------------------------------------------

    def _select(self, user_id: str, video_id: Optional[int], *columns):
        stmt = (
            select(Chunk, Video.filename, Video.title, Video.duration_s, *columns)
            .join(Video, Video.id == Chunk.video_id)
            .where(Chunk.user_id == user_id)
        )
        return stmt.where(Chunk.video_id == video_id) if video_id is not None else stmt

    def retrieve(self, db: Session, user_id: str, question: str,
                 video_id: Optional[int] = None, top_k: Optional[int] = None) -> List[Dict]:
        """Nearest chunks belonging to this user, optionally within one lecture."""
        vector = get_embedder(self.embedding_model).embed_one(question)
        distance = Chunk.embedding.cosine_distance(vector).label("distance")
        stmt = self._select(user_id, video_id, distance).order_by(distance)
        rows = db.execute(stmt.limit(top_k or settings.default_top_k)).all()
        return [
            to_source(chunk, title or filename, duration, round(max(0.0, 1.0 - float(dist)), 4))
            for chunk, filename, title, duration, dist in rows
        ]

    def lecture_passages(self, db: Session, user_id: str, video_id: int) -> List[Dict]:
        """Every chunk of one lecture, in the order it was spoken."""
        rows = db.execute(self._select(user_id, video_id).order_by(Chunk.start_s)).all()
        return [to_source(chunk, title or filename, duration) for chunk, filename, title, duration in rows]

    def transcript(self, db: Session, user_id: str, video_id: int) -> List[Dict]:
        """The lecture as readable, de-duplicated lines with timestamps."""
        return transcript_lines(self.lecture_passages(db, user_id, video_id))

    def gather(self, db: Session, user_id: str, question: str, mode: str,
               video_id: Optional[int], top_k: Optional[int]) -> List[Dict]:
        if tool_for(mode) and video_id is not None:
            return self.lecture_passages(db, user_id, video_id)
        return self.retrieve(db, user_id, question, video_id, top_k)

    # -- prompt assembly ---------------------------------------------------

    @staticmethod
    def build_user_message(question: str, sources: List[Dict], budget_tokens: int) -> str:
        budget = budget_tokens * 4  # ~4 characters per token
        parts, used = [], 0
        for i, src in enumerate(sources, 1):
            block = f"[Excerpt {i} | {src['timestamp']} | {src['video']}]\n{src['text']}\n"
            if used + len(block) > budget:
                break
            parts.append(block)
            used += len(block)
        return "Lecture excerpts:\n\n" + "\n".join(parts) + f"\n\nStudent's question: {question}"

    @staticmethod
    def cache_key(question: str, sources: List[Dict], model: str, mode: str = "ask") -> str:
        fingerprint = "|".join(str(s["chunk_id"]) for s in sources)
        raw = f"{PROMPT_VERSION}::{model}::{mode}::{question.strip().lower()}::{fingerprint}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # -- answering ---------------------------------------------------------

    def _done(self, started: float, answer: str, sources: List[Dict], usage: Dict, **extra) -> Dict:
        return {
            "type": "done",
            "answer": answer,
            "sources": sources,
            "num_sources": len(sources),
            "response_time": round(time.time() - started, 2),
            "usage": usage,
            **extra,
        }

    def stream_answer(self, question: str, sources: List[Dict], mode: str = "ask") -> Iterator[Dict]:
        """
        Yields sources, then text deltas, then a final done/error event.

        `sources` come from gather(); keeping that step outside lets the caller
        check the answer cache before any tokens are spent.
        """
        started = time.time()
        tool = tool_for(mode)
        empty_usage = ClaudeUsage(model=self.model_name).to_dict()

        # A study tool's passages are the whole lecture; only the cited ones are
        # sent once the answer is known.
        yield {"type": "sources", "sources": [] if tool else sources}

        if not sources:
            yield self._done(started, EMPTY_ANSWER, [], empty_usage)
            return

        system = f"{SYSTEM_PROMPT}\n\n{tool.instruction}" if tool else SYSTEM_PROMPT
        budget = settings.study_context_tokens if tool else settings.max_context_tokens
        max_tokens = settings.study_max_tokens if tool else None
        message = self.build_user_message(question, sources, budget)

        try:
            answer, usage, gate = "", empty_usage, CoverageGate()
            for event in get_claude_client().stream(system, message, max_tokens=max_tokens):
                if event["type"] == "delta":
                    text = gate.feed(event["text"])
                    if text:
                        yield {"type": "delta", "text": text}
                elif event["type"] == "done":
                    answer, usage = event["text"], event["usage"]

            tail = gate.finish()
            if tail:
                yield {"type": "delta", "text": tail}
        except Exception as e:
            yield {"type": "error", "message": safe_detail(
                e, "claude", CLAUDE_UNAVAILABLE, dev=describe_api_error(e))}
            return

        if gate.not_covered or is_not_covered(answer):
            # Nothing relevant: one line, and none of the excerpts that happened
            # to be nearest, so there is nothing to cite or to click.
            yield self._done(started, NOT_COVERED_MESSAGE, [], usage, not_covered=True)
            return

        yield self._done(started, answer, cited_sources(answer, sources) if tool else sources, usage)


_rag_service: Optional[LectureRAGService] = None


def get_rag_service() -> LectureRAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = LectureRAGService()
    return _rag_service
