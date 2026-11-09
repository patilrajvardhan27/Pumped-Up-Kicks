"""
Checks every upload passes, whichever path it takes (presigned or direct).

The content type is derived from the extension here, never taken from the
browser: a presigned PUT is signed for one type, and letting the client choose
it would let someone store an HTML page that storage later serves as a page.
"""
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from api.config import settings
from api.deps import RequestContext
from api.models.database import Video

CONTENT_TYPES = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
    ".mkv": "video/x-matroska", ".webm": "video/webm", ".avi": "video/x-msvideo",
}
MAX_FILENAME = 255


def content_type_for(filename: str) -> str:
    return CONTENT_TYPES.get(Path(filename).suffix.lower(), "video/mp4")


def validate_filename(filename: Optional[str]) -> str:
    """Return the content type for an acceptable filename, or reject it."""
    if not filename or len(filename) > MAX_FILENAME:
        raise HTTPException(status_code=400, detail=f"File names must be 1 to {MAX_FILENAME} characters.")
    ext = Path(filename).suffix.lower()
    if ext not in CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or filename}'. Use one of: {', '.join(sorted(CONTENT_TYPES))}",
        )
    return CONTENT_TYPES[ext]


def check_size(size: Optional[int]) -> None:
    if size is not None and size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"That file is larger than the {settings.max_upload_bytes // (1024 ** 3)} GB limit.",
        )


def claim_filename(ctx: RequestContext, filename: str) -> None:
    taken = ctx.db.query(Video.id).filter(Video.user_id == ctx.user_id, Video.filename == filename).first()
    if taken:
        raise HTTPException(
            status_code=409,
            detail=f"You already have a lecture named '{filename}'. Rename it, or delete the existing one.",
        )
