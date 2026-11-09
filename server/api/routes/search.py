"""
Full-text search across a subject's transcripts and course documents.

Postgres full-text search over chunk text, using the expression the
ix_chunks_text_search index was built on, so it never scans the table.
websearch_to_tsquery accepts anything a person types ("quoted phrases", or,
-not) without a syntax error. Matches in the snippet are wrapped in ⟦ and ⟧,
which the client turns into highlights; the snippet itself is plain text and
is never rendered as HTML.
"""
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, literal_column, select

from api.deps import Ctx, RequestContext
from api.models.database import Chunk, Document, Video
from api.services.lecture_rag_service import format_timestamp, page_label

router = APIRouter(prefix="/api/search", tags=["search"])

HIGHLIGHT = 'StartSel=⟦, StopSel=⟧, MaxWords=28, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "'
PER_SOURCE = 3


class SearchHit(BaseModel):
    kind: str
    chunk_id: int
    title: str
    snippet: str
    rank: float
    video_id: Optional[int] = None
    start: Optional[float] = None
    end: Optional[float] = None
    timestamp: Optional[str] = None
    document_id: Optional[int] = None
    page: Optional[int] = None
    page_label: Optional[str] = None
    url: Optional[str] = None


@router.get("", response_model=List[SearchHit])
def search(
    q: str = Query(..., min_length=2, max_length=200),
    workspace_id: Optional[int] = None,
    unsorted: bool = False,
    limit: int = Query(30, ge=1, le=100),
    ctx: RequestContext = Ctx,
):
    """The caller's passages matching `q`, in one subject, in Unsorted, or (neither given) everywhere."""
    english = literal_column("'english'")
    query = func.websearch_to_tsquery(english, q)
    vector = func.to_tsvector(english, Chunk.text)
    rank = func.ts_rank_cd(vector, query).label("rank")
    snippet = func.ts_headline(english, Chunk.text, query, HIGHLIGHT).label("snippet")

    stmt = (
        select(Chunk, Video, Document, rank, snippet)
        .outerjoin(Video, Video.id == Chunk.video_id)
        .outerjoin(Document, Document.id == Chunk.document_id)
        .where(Chunk.user_id == ctx.user_id, vector.op("@@")(query))
        .order_by(rank.desc(), Chunk.id)
        .limit(limit * PER_SOURCE)
    )
    subject = func.coalesce(Video.workspace_id, Document.workspace_id)
    if workspace_id is not None:
        stmt = stmt.where(subject == workspace_id)
    elif unsorted:
        stmt = stmt.where(subject.is_(None))

    hits: List[SearchHit] = []
    per_source: dict = {}
    for chunk, video, document, score, text in ctx.db.execute(stmt).all():
        # Overlapping lecture windows repeat the same words; a few hits per source is plenty.
        key = ("video", chunk.video_id) if video is not None else ("document", chunk.document_id)
        per_source[key] = per_source.get(key, 0) + 1
        if per_source[key] > PER_SOURCE:
            continue
        if document is not None:
            hits.append(SearchHit(
                kind="document", chunk_id=chunk.id, title=document.title, snippet=text,
                rank=float(score), document_id=document.id, page=chunk.page,
                page_label=page_label(chunk.page, document.mime_type) or None, url=document.url,
            ))
        elif video is not None:
            hits.append(SearchHit(
                kind="video", chunk_id=chunk.id, title=video.title or video.filename, snippet=text,
                rank=float(score), video_id=video.id, start=chunk.start_s, end=chunk.end_s,
                timestamp=format_timestamp(chunk.start_s),
            ))
        if len(hits) >= limit:
            break
    return hits
