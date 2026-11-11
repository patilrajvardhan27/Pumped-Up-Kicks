"""
Checks every upload passes, and fetching a lecture only if it belongs to the caller.
"""
import logging
from pathlib import Path

from fastapi import HTTPException

from api.config import settings
from api.deps import RequestContext
from api.models.database import Video
from api.services.storage import get_storage

log = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
CONTENT_TYPES = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
    ".mkv": "video/x-matroska", ".webm": "video/webm", ".avi": "video/x-msvideo",
}


def validate_filename(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or filename}'. "
                   f"Use one of: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


def claim_filename(ctx: RequestContext, filename: str) -> None:
    existing = (
        ctx.db.query(Video)
        .filter(Video.user_id == ctx.user_id, Video.filename == filename)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"You already have a lecture named '{filename}'. "
                   "Rename it, or delete the existing one.",
        )


def too_large() -> str:
    return f"That file is larger than the {settings.max_upload_bytes // (1024 ** 3)} GB limit."


def discard(ctx: RequestContext, video: Video) -> None:
    """Drop a reservation whose upload can't be used, and its object."""
    try:
        get_storage().delete(video.storage_key)
    except Exception:
        log.warning("Could not remove object %s", video.storage_key, exc_info=True)
    ctx.db.delete(video)
    ctx.db.commit()


def owned_video(ctx: RequestContext, video_id: int) -> Video:
    video = (
        ctx.db.query(Video)
        .filter(Video.id == video_id, Video.user_id == ctx.user_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video
