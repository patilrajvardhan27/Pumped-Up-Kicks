"""
Lecture Q&A: retrieve the relevant passages of a user's own lectures and course
material, then let Claude answer using only those.

The whole multi-tenancy story is the `where Chunk.user_id == user_id` below:
one user can never retrieve another's lecture, and the filter is applied inside
the vector search rather than after it. The conversation's scope (one lecture,
one subject, Unsorted, or everything) narrows the search further and never
widens it.
"""
import hashlib
import sys
import time
from pathlib import Path
from typing import Dict, Iterator, List, Optional

from sqlalchemy import func, select
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
from api.services.coverage import MESSAGE as NOT_COVERED_MESSAGE  # noqa: E402
from api.services.coverage import PROMPT_VERSION, CoverageGate, is_not_covered  # noqa: E402
from api.models.database import Chunk, Document, Video  # noqa: E402
from api.services.document_text import PPTX  # noqa: E402
from api.services.scope import ALL, ChatScope  # noqa: E402

SYSTEM_PROMPT = """You are a teaching assistant for a student reviewing their own recorded lectures and course material.

You answer only from the excerpts you are given. A lecture excerpt is labelled with a timestamp and the lecture it came from. A course-material excerpt is labelled with a reference such as Doc 3, the document it came from, and its page or slide where it has one.

Rules:
- Ground every claim in the excerpts.
- If the excerpts have nothing to do with the question, reply with exactly NOT_COVERED and nothing else. Do not say what the excerpts cover instead.
- If they cover only part of the question, answer that part and say plainly which part the material does not address. Do not describe unrelated material.
- Cite a lecture excerpt by its timestamp in square brackets right after the claim it supports, like [12:04].
- Cite a course-material excerpt by its reference in square brackets, like [Doc 3]. One reference per pair of brackets.
- When both lecture and course-material excerpts bear on the question, use and cite both.
- If the material gives several reasons, limitations, or examples, list all of them.
- Prefer the lecturer's own terminology over synonyms.
- Be direct and concise. No preamble, no restating the question."""


def format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    h, m, s = total // 3600, (total % 3600) // 60, total % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def page_label(page: Optional[int], mime_type: Optional[str]) -> str:
    """'slide 4' for a deck, 'p. 4' otherwise, '' when the format has no pages."""
    if page is None:
        return ""
    return f"slide {page}" if mime_type == PPTX else f"p. {page}"


def video_source(chunk: Chunk, filename: str, title: Optional[str], duration: Optional[float]) -> Dict:
    return {
        "kind": "video",
        "chunk_id": chunk.id,
        "video_id": chunk.video_id,
        "text": chunk.text,
        "start": chunk.start_s,
        "end": chunk.end_s,
        "timestamp": f"{format_timestamp(chunk.start_s)} - {format_timestamp(chunk.end_s)}",
        "video": title or filename,
        "video_filename": filename,
        "video_duration": duration,
    }


def document_source(chunk: Chunk, document: Document, ref: Optional[str] = None) -> Dict:
    label = page_label(chunk.page, document.mime_type)
    return {
        "kind": "document",
        "chunk_id": chunk.id,
        "document_id": document.id,
        "text": chunk.text,
        "page": chunk.page,
        "timestamp": label,
        # `video` is the name the citation list shows, kept for older clients.
        "video": document.title,
        "document_title": document.title,
        "url": document.url,
        "ref": ref,
    }


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
        scope: ChatScope = ALL,
        top_k: Optional[int] = None,
    ) -> List[Dict]:
        """Nearest chunks belonging to this user, within the conversation's scope."""
        k = top_k or settings.default_top_k
        query_vector = get_embedder(self.embedding_model).embed_one(question)

        distance = Chunk.embedding.cosine_distance(query_vector)
        stmt = (
            select(Chunk, Video, Document, distance.label("distance"))
            .outerjoin(Video, Video.id == Chunk.video_id)
            .outerjoin(Document, Document.id == Chunk.document_id)
            .where(Chunk.user_id == user_id)
            .order_by(distance)
            .limit(k)
        )
        if scope.kind == "video":
            rows = db.execute(stmt.where(Chunk.video_id == scope.video_id)).all()
        else:
            if scope.kind == "workspace":
                # A chunk has exactly one parent, so this is that parent's subject.
                subject = func.coalesce(Video.workspace_id, Document.workspace_id)
                stmt = stmt.where(
                    subject.is_(None) if scope.workspace_id is None else subject == scope.workspace_id
                )
            rows = self._balanced(
                db.execute(stmt.where(Chunk.video_id.is_not(None))).all(),
                db.execute(stmt.where(Chunk.document_id.is_not(None))).all(),
                k,
            )

        sources = []
        for position, (chunk, video, document, dist) in enumerate(rows, start=1):
            if document is not None:
                source = document_source(chunk, document, ref=f"Doc {position}")
            else:
                source = video_source(chunk, video.filename, video.title, video.duration_s)
            source["similarity"] = round(max(0.0, 1.0 - float(dist)), 4)
            sources.append(source)
        return sources

    @staticmethod
    def _balanced(lectures: List, documents: List, k: int) -> List:
        """
        Merge the nearest lecture and document passages. Each kind keeps up to
        a third of the places when it has candidates, so a subject's answer can
        draw on (and cite) both even when one kind is more numerous; the rest
        go to whichever passages are nearest. Rows are (chunk, video, document, distance).
        """
        reserve = max(1, k // 3)
        kept = lectures[:reserve] + documents[:reserve]
        rest = sorted(lectures[reserve:] + documents[reserve:], key=lambda row: row[-1])
        return sorted(kept + rest[: max(0, k - len(kept))], key=lambda row: row[-1])[:k]

    # -- prompt assembly ---------------------------------------------------

    def build_user_message(self, question: str, sources: List[Dict]) -> str:
        budget = settings.max_context_tokens * 4  # ~4 characters per token
        parts, used = [], 0

        for i, src in enumerate(sources, 1):
            if src.get("kind") == "document":
                where = f", {src['timestamp']}" if src.get("timestamp") else ""
                block = f"[Doc {i} | {src['document_title']}{where}]\n{src['text']}\n"
            else:
                block = f"[Excerpt {i} | {src['timestamp']} | {src['video']}]\n{src['text']}\n"
            if used + len(block) > budget:
                break
            parts.append(block)
            used += len(block)

        return (
            "Excerpts:\n\n"
            + "\n".join(parts)
            + f"\n\nStudent's question: {question}"
        )

    @staticmethod
    def cache_key(question: str, sources: List[Dict], model: str, scope: ChatScope = ALL) -> str:
        """
        The chunk fingerprint already ties an answer to the excerpts it was
        written from. The scope is in the key too, so an answer cached in one
        subject is never served in another, even when both retrieve the same
        passages (a lecture that moved between subjects, say).
        """
        fingerprint = "|".join(str(s["chunk_id"]) for s in sources)
        raw = (
            f"{PROMPT_VERSION}::{model}::{scope.cache_token}::"
            f"{question.strip().lower()}::{fingerprint}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def empty_answer() -> str:
        return (
            "Nothing is indexed here yet. Upload a lecture or import course material "
            "from Canvas, wait for it to finish processing, then ask again."
        )

    # -- answering ---------------------------------------------------------

    def answer(
        self,
        db: Session,
        user_id: str,
        question: str,
        scope: ChatScope = ALL,
        top_k: Optional[int] = None,
    ) -> Dict:
        started = time.time()
        sources: List[Dict] = []

        try:
            sources = self.retrieve(db, user_id, question, scope, top_k)

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

            if is_not_covered(result["text"]):
                # Nothing relevant: one line, and none of the excerpts that happened
                # to be nearest, so there is nothing to cite or to click.
                return {
                    "answer": NOT_COVERED_MESSAGE,
                    "sources": [],
                    "response_time": round(time.time() - started, 2),
                    "num_sources": 0,
                    "usage": result["usage"].to_dict(),
                    "cache_hit": False,
                    "not_covered": True,
                }

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
        scope: ChatScope = ALL,
        top_k: Optional[int] = None,
    ) -> Iterator[Dict]:
        """Yields sources, then text deltas, then a final done/error event."""
        started = time.time()

        try:
            sources = self.retrieve(db, user_id, question, scope, top_k)
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
            gate = CoverageGate()

            for event in get_claude_client().stream(
                SYSTEM_PROMPT, self.build_user_message(question, sources)
            ):
                if event["type"] == "delta":
                    text = gate.feed(event["text"])
                    if text:
                        yield {"type": "delta", "text": text}
                elif event["type"] == "done":
                    answer, usage = event["text"], event["usage"]

            tail = gate.finish()
            if tail:
                yield {"type": "delta", "text": tail}

            if gate.not_covered or is_not_covered(answer):
                yield {
                    "type": "done",
                    "answer": NOT_COVERED_MESSAGE,
                    "sources": [],
                    "num_sources": 0,
                    "response_time": round(time.time() - started, 2),
                    "usage": usage,
                    "not_covered": True,
                }
                return

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
