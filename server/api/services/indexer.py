"""
Turns a transcript, or a document's text, into searchable chunks in Postgres.

Transcript chunks are built from a target duration rather than a fixed number
of Whisper segments, with overlap, so each one carries a complete idea. Bigger,
self-contained chunks mean fewer excerpts are needed per answer, which is both
cheaper and more accurate than the old three-segment grouping.

Document chunks are built the same way from characters instead of seconds, and
never cross a page or slide, so every chunk can be cited by its page number.
"""
import sys
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

SERVER_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(SERVER_DIR / "src"))

from services.embeddings.embedder import get_embedder  # noqa: E402

from api.config import settings  # noqa: E402
from api.models.database import Chunk, Document  # noqa: E402

# ~75 seconds of speech is roughly a paragraph of explanation: long enough to
# stand alone, short enough to stay on one topic.
TARGET_CHUNK_SECONDS = 75.0
OVERLAP_SECONDS = 18.0

# About the same amount of text as a 75-second chunk of speech, which keeps a
# document chunk inside the embedder's input limit too.
TARGET_CHUNK_CHARS = 1000
OVERLAP_CHARS = 150


def build_chunks(
    segments: List[Dict],
    target_seconds: float = TARGET_CHUNK_SECONDS,
    overlap_seconds: float = OVERLAP_SECONDS,
) -> List[Dict]:
    """
    Group timestamped segments into overlapping windows.

    Each result is {"text", "start_s", "end_s"}. Overlap means a sentence that
    straddles a boundary is still retrievable from at least one whole chunk.
    """
    if not segments:
        return []

    ordered = sorted(segments, key=lambda s: s.get("start", 0) or 0)
    chunks: List[Dict] = []
    i = 0

    while i < len(ordered):
        window: List[Dict] = []
        start_s = float(ordered[i].get("start", 0) or 0)

        j = i
        while j < len(ordered):
            end_s = float(ordered[j].get("end", start_s) or start_s)
            window.append(ordered[j])
            if end_s - start_s >= target_seconds:
                break
            j += 1

        text = " ".join((s.get("text") or "").strip() for s in window).strip()
        if text:
            chunks.append({
                "text": text,
                "start_s": start_s,
                "end_s": float(window[-1].get("end", start_s) or start_s),
            })

        if j >= len(ordered) - 1:
            break

        # Step back far enough to create the overlap, but always make progress.
        next_i = j + 1
        boundary = float(window[-1].get("end", start_s) or start_s) - overlap_seconds
        for k in range(i + 1, j + 1):
            if float(ordered[k].get("start", 0) or 0) >= boundary:
                next_i = k
                break
        i = max(next_i, i + 1)

    return chunks


def index_transcript(
    db: Session,
    video_id: int,
    user_id: str,
    segments: List[Dict],
    replace: bool = True,
) -> int:
    """
    Embed a transcript and store it. Returns the number of chunks written.

    Deleting by video_id is a normal indexed DELETE here — under FAISS this
    meant rebuilding the entire index from scratch.
    """
    if replace:
        db.query(Chunk).filter(
            Chunk.video_id == video_id, Chunk.user_id == user_id
        ).delete(synchronize_session=False)
        db.commit()

    pieces = build_chunks(segments)
    if not pieces:
        return 0

    embedder = get_embedder(settings.embedding_model)
    vectors = embedder.embed_many(p["text"] for p in pieces)

    db.add_all([
        Chunk(
            video_id=video_id,
            user_id=user_id,
            text=piece["text"],
            start_s=piece["start_s"],
            end_s=piece["end_s"],
            embedding=vector,
        )
        for piece, vector in zip(pieces, vectors)
    ])
    db.commit()

    print(f"[Indexer] video={video_id} chunks={len(pieces)}")
    return len(pieces)


def build_text_chunks(
    pages,
    target_chars: int = TARGET_CHUNK_CHARS,
    overlap_chars: int = OVERLAP_CHARS,
) -> List[Dict]:
    """
    Overlapping windows of words within each page. Each result is
    {"text", "page"}; page is None for formats without page numbers.
    """
    chunks: List[Dict] = []
    for page in pages:
        words = page.text.split()
        i = 0
        while i < len(words):
            window, size, j = [], 0, i
            while j < len(words) and (size + len(words[j]) + 1 <= target_chars or not window):
                window.append(words[j])
                size += len(words[j]) + 1
                j += 1
            chunks.append({"text": " ".join(window), "page": page.number})
            if j >= len(words):
                break
            # Step back far enough to overlap, but always make progress.
            back, k = 0, j
            while k > i + 1 and back < overlap_chars:
                k -= 1
                back += len(words[k]) + 1
            i = k
    return chunks


def index_document(db: Session, document: Document, pages) -> int:
    """Replace a document's chunks with fresh ones. Returns the number written."""
    db.query(Chunk).filter(
        Chunk.document_id == document.id, Chunk.user_id == document.user_id
    ).delete(synchronize_session=False)

    pieces = build_text_chunks(pages)
    if pieces:
        vectors = get_embedder(settings.embedding_model).embed_many(p["text"] for p in pieces)
        db.add_all([
            Chunk(
                document_id=document.id,
                user_id=document.user_id,
                text=piece["text"],
                page=piece["page"],
                embedding=vector,
            )
            for piece, vector in zip(pieces, vectors)
        ])

    document.num_chunks = len(pieces)
    db.commit()
    return len(pieces)


def load_segments_file(path: Path) -> Optional[List[Dict]]:
    import json

    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f).get("segments", [])
