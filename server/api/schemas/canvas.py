"""Canvas connection, course and sync request and response models."""
from typing import List, Optional

from pydantic import BaseModel, Field

# --- schemas ----------------------------------------------------------------


class SyncStatus(BaseModel):
    stage: str
    progress: int
    detail: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    summary: Optional[dict] = None


class ConnectionStatus(BaseModel):
    connected: bool
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    connected_at: Optional[str] = None
    sync: Optional[SyncStatus] = None
    # What this server offers, so the client knows which way to connect.
    schools: List[str] = []
    personal_tokens_allowed: bool = False


class StartRequest(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=255)


class StartResponse(BaseModel):
    authorize_url: str


class CompleteRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=2048)
    state: str = Field(..., min_length=1, max_length=2048)


class TokenRequest(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=255)
    token: str = Field(..., min_length=10, max_length=512)


class CourseInfo(BaseModel):
    id: int
    name: str
    course_code: Optional[str] = None
    term: Optional[str] = None
    workspace_id: Optional[int] = None


class CourseLink(BaseModel):
    course_id: int
    # The subject to fill from this course; null creates one named after it.
    workspace_id: Optional[int] = None


class SyncRequest(BaseModel):
    """Courses to link (or re-link) before syncing, and courses to stop syncing."""

    link: List[CourseLink] = Field(default_factory=list, max_length=200)
    unlink: List[int] = Field(default_factory=list, max_length=200)
