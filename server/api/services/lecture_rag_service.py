"""
Lecture Q&A: retrieve the relevant passages of a user's own lectures, then let
Claude answer using only those.

The whole multi-tenancy story is the `where Chunk.user_id == user_id` below —
one user can never retrieve another's lecture, and the filter is applied inside
the vector search rather than after it.
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
from services.llm.claude_client import (  # noqa: E402
    ClaudeUsage,
    describe_api_error,
    get_claude_client,
)

from api.config import settings  # noqa: E402
from api.models.database import Chunk, Video  # noqa: E402

SYSTEM_PROMPT = """You are a teaching assistant for a student reviewing their own recorded lectures.

You answer only from the lecture excerpts you are given. Each excerpt is labelled with a timestamp and the video it came from.

Rules:
- Ground every claim in the excerpts. If they do not contain the answer, say so plainly and name what the excerpts do cover.
- Cite the timestamp in square brackets right after the claim it supports, like [12:04].
- If the lecture gives several reasons, limitations, or examples, list all of them.
- Prefer the lecturer's own terminology over synonyms.
- Be direct and concise. No preamble, no restating the question."""


def format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    h, m, s = total // 3600, (total % 3600) // 60, total % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


class LectureRAGService:
    """Stateless. Every method takes the session and the owning user."""

    def __init__(self):
        self.model_name = settings.puk_claude_model
        self.embedding_model = settings.embedding_model

    # -- retrieval --------------------------------------------------------

    def retrieve(
        self,
        db: Session,
        user_id: str,
        question: str,
        video_id: Optional[int] = None,
        top_k: Optional[int] = None,
    ) -> List[Dict]:
        """Nearest chunks belonging to this user, optionally within one lecture."""
        k = top_k or settings.default_top_k
        query_vector = get_embedder(self.embedding_model).embed_one(question)

        distance = Chunk.embedding.cosine_distance(query_vector)
        stmt = (
            select(Chunk, Video.filename, Video.title, Video.duration_s, distance.label("distance"))
            .join(Video, Video.id == Chunk.video_id)
            .where(Chunk.user_id == user_id)
            .order_by(distance)
            .limit(k)
        )
        if video_id is not None:
            stmt = stmt.where(Chunk.video_id == video_id)

        rows = db.execute(stmt).all()

        return [
            {
                "chunk_id": chunk.id,
                "video_id": chunk.video_id,
                "text": chunk.text,
                "start": chunk.start_s,
                "end": chunk.end_s,
                "timestamp": f"{format_timestamp(chunk.start_s)} - {format_timestamp(chunk.end_s)}",
                "video": title or filename,
                "video_filename": filename,
                "video_duration": duration,
                "similarity": round(max(0.0, 1.0 - float(dist)), 4),
            }
            for chunk, filename, title, duration, dist in rows
        ]

    # -- prompt assembly ---------------------------------------------------

    def build_user_message(self, question: str, sources: List[Dict]) -> str:
        budget = settings.max_context_tokens * 4  # ~4 characters per token
        parts, used = [], 0

        for i, src in enumerate(sources, 1):
            block = f"[Excerpt {i} | {src['timestamp']} | {src['video']}]\n{src['text']}\n"
            if used + len(block) > budget:
                break
            parts.append(block)
            used += len(block)

        return (
            "Lecture excerpts:\n\n"
            + "\n".join(parts)
            + f"\n\nStudent's question: {question}"
        )

    @staticmethod
    def cache_key(question: str, sources: List[Dict], model: str) -> str:
        fingerprint = "|".join(str(s["chunk_id"]) for s in sources)
        raw = f"{model}::{question.strip().lower()}::{fingerprint}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def empty_answer() -> str:
        return (
            "No lecture content is indexed yet. Upload a video and wait for it to "
            "finish processing, then ask again."
        )

    # -- answering ---------------------------------------------------------

    def answer(
        self,
        db: Session,
        user_id: str,
        question: str,
        video_id: Optional[int] = None,
        top_k: Optional[int] = None,
    ) -> Dict:
        started = time.time()
        sources: List[Dict] = []

        try:
            sources = self.retrieve(db, user_id, question, video_id, top_k)

            if not sources:
                return {
                    "answer": self.empty_answer(),
                    "sources": [],
                    "response_time": round(time.time() - started, 2),
                    "num_sources": 0,
                    "usage": ClaudeUsage(model=self.model_name).to_dict(),
                    "cache_hit": False,
                }

            result = get_claude_client().complete(
                SYSTEM_PROMPT, self.build_user_message(question, sources)
            )

            return {
                "answer": result["text"],
                "sources": sources,
                "response_time": round(time.time() - started, 2),
                "num_sources": len(sources),
                "usage": result["usage"].to_dict(),
                "cache_hit": False,
            }

        except Exception as e:
            message = describe_api_error(e)
            print(f"[Lecture RAG] {message}")
            return {
                "answer": message,
                "sources": sources,
                "response_time": round(time.time() - started, 2),
                "num_sources": len(sources),
                "usage": ClaudeUsage(model=self.model_name).to_dict(),
                "cache_hit": False,
                "error": True,
            }

    def stream_answer(
        self,
        db: Session,
        user_id: str,
        question: str,
        video_id: Optional[int] = None,
        top_k: Optional[int] = None,
    ) -> Iterator[Dict]:
        """Yields sources, then text deltas, then a final done/error event."""
        started = time.time()

        try:
            sources = self.retrieve(db, user_id, question, video_id, top_k)
        except Exception as e:
            yield {"type": "error", "message": f"Retrieval failed: {e}"}
            return

        yield {"type": "sources", "sources": sources}

        if not sources:
            yield {
                "type": "done",
                "answer": self.empty_answer(),
                "sources": [],
                "num_sources": 0,
                "response_time": round(time.time() - started, 2),
                "usage": ClaudeUsage(model=self.model_name).to_dict(),
            }
            return

        try:
            answer, usage = "", ClaudeUsage(model=self.model_name).to_dict()

            for event in get_claude_client().stream(
                SYSTEM_PROMPT, self.build_user_message(question, sources)
            ):
                if event["type"] == "delta":
                    yield event
                elif event["type"] == "done":
                    answer, usage = event["text"], event["usage"]

            yield {
                "type": "done",
                "answer": answer,
                "sources": sources,
                "num_sources": len(sources),
                "response_time": round(time.time() - started, 2),
                "usage": usage,
            }

        except Exception as e:
            yield {"type": "error", "message": describe_api_error(e)}

    # -- health -------------------------------------------------------------

    def stats(self, db: Session, user_id: str) -> Dict:
        indexed = db.query(Chunk).filter(Chunk.user_id == user_id).count()
        return {
            "status": "healthy",
            "documents_indexed": indexed,
            "embedding_model": self.embedding_model,
            "llm_model": self.model_name,
            "vector_store": "pgvector",
        }


_rag_service: Optional[LectureRAGService] = None


def get_rag_service() -> LectureRAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = LectureRAGService()
    return _rag_service
