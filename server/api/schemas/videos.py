"""Video library request and response models."""
from typing import List, Optional

from pydantic import BaseModel, Field

from api.config import settings
from api.models.database import Video
from api.services.video_processor import STAGE_LABELS


class VideoInfo(BaseModel):
    id: int
    workspace_id: Optional[int] = None
    filename: str
    title: Optional[str]
    duration: Optional[float]
    uploaded_at: str
    file_size: Optional[int]
    stage: str
    stage_label: str
    progress: int
    error_message: Optional[str] = None
    num_segments: Optional[int] = None
    num_chunks: Optional[int] = None


class VideoListResponse(BaseModel):
    total: int
    videos: List[VideoInfo]


class PresignRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=settings.max_title_chars)
    file_size: Optional[int] = Field(None, ge=1)
    # The subject to file the lecture under; null leaves it in Unsorted.
    workspace_id: Optional[int] = None


class PresignResponse(BaseModel):
    """When upload_url is null the client posts to /upload instead."""
    video_id: int
    upload_url: Optional[str]
    method: str


class UploadResponse(BaseModel):
    message: str
    video_id: int
    filename: str
    status: str


class MoveRequest(BaseModel):
    """Null moves the lecture to Unsorted."""
    workspace_id: Optional[int] = None


class PlaybackResponse(BaseModel):
    """A URL a <video> element can load directly, and when it stops working."""
    url: str
    expires_in: int
    duration: Optional[float] = None
    content_type: str


def to_info(video: Video) -> VideoInfo:
    return VideoInfo(
        id=video.id,
        workspace_id=video.workspace_id,
        filename=video.filename,
        title=video.title or video.filename,
        duration=video.duration_s,
        uploaded_at=video.created_at.isoformat(),
        file_size=video.file_size,
        stage=video.stage,
        stage_label=STAGE_LABELS.get(video.stage, video.stage),
        progress=video.progress,
        error_message=video.error_message,
        num_segments=video.num_segments,
        num_chunks=video.num_chunks,
    )
