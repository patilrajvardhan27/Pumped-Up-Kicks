"""
Turns a transcript into searchable chunks in Postgres.

Chunks are built from a target duration rather than a fixed number of Whisper
segments, with overlap, so each one carries a complete idea. Bigger,
self-contained chunks mean fewer excerpts are needed per answer, which is both
cheaper and more accurate than the old three-segment grouping.
"""
import sys
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

SERVER_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(SERVER_DIR / "src"))

from services.embeddings.embedder import get_embedder  # noqa: E402

from api.config import settings  # noqa: E402
from api.models.database import Chunk  # noqa: E402

# ~75 seconds of speech is roughly a paragraph of explanation: long enough to
# stand alone, short enough to stay on one topic.
TARGET_CHUNK_SECONDS = 75.0
OVERLAP_SECONDS = 18.0


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


def load_segments_file(path: Path) -> Optional[List[Dict]]:
    import json

    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f).get("segments", [])
