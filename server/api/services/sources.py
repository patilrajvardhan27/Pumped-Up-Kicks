"""
How a cited passage is described: its timestamp or page, and the dict the client
receives.
"""
import logging
from typing import Dict, Optional

from api.models.database import Chunk, Document
from api.services.document_text import PPTX

log = logging.getLogger(__name__)


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
