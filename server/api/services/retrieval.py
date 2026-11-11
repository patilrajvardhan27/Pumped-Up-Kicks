"""
Vector search over one user's chunks, limited to a conversation's scope, with
lecture and document passages balanced so an answer can cite both.
"""
import logging
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.config import settings
from api.models.database import Chunk, Document, Video
from api.services.embedder import get_embedder
from api.services.scope import ALL, ChatScope

log = logging.getLogger(__name__)
from api.services.sources import document_source, video_source


class Retrieval:
    """Mixed into the answering service. Needs `self.embedding_model`."""

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
