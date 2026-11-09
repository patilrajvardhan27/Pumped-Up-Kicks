"""Video library request and response models."""
from typing import List, Optional

from pydantic import BaseModel, Field

from api.config import settings
from api.models.database import Video
from api.services.video_processor import STAGE_LABELS


class VideoInfo(BaseModel):
    id: int
    filename: str
    title: Optional[str]
    duration: Optional[float]
    uploaded_at: str
    file_size: Optional[int]
    stage: str
    stage_label: str
    progress: int
    error_message: Optional[str] = None
    num_chunks: Optional[int] = None

    @classmethod
    def of(cls, video: Video) -> "VideoInfo":
        return cls(
            id=video.id,
            filename=video.filename,
            title=video.title or video.filename,
            duration=video.duration_s,
            uploaded_at=video.created_at.isoformat(),
            file_size=video.file_size,
            stage=video.stage,
            stage_label=STAGE_LABELS.get(video.stage, video.stage),
            progress=video.progress,
            error_message=video.error_message,
            num_chunks=video.num_chunks,
        )


class VideoListResponse(BaseModel):
    total: int
    videos: List[VideoInfo]


class PresignRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    title: Optional[str] = Field(None, max_length=settings.max_title_chars)
    file_size: Optional[int] = Field(None, ge=0)


class PresignResponse(BaseModel):
    """When upload_url is null the client posts to /upload instead.

    The client must PUT with exactly `content_type`: it is part of the signature.
    """
    video_id: int
    upload_url: Optional[str]
    content_type: str


class UploadResponse(BaseModel):
    message: str
    video_id: int
    filename: str
    status: str


class PlaybackResponse(BaseModel):
    """A URL a <video> element can load directly, and when it stops working."""
    url: str
    expires_in: int
    duration: Optional[float] = None
    content_type: str


class TranscriptLine(BaseModel):
    start: float
    end: float
    text: str


class TranscriptResponse(BaseModel):
    video_id: int
    title: str
    lines: List[TranscriptLine]
