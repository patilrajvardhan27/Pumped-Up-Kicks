"""Chat request and response models."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from api.config import settings

# "ask" answers a typed question from the closest passages. The others are the
# one-click study tools, which read the whole lecture (see services/study.py).
Mode = Literal["ask", "notes", "terms", "quiz"]


class Source(BaseModel):
    chunk_id: Optional[int] = None
    video_id: Optional[int] = None
    text: str
    timestamp: str
    video: str
    start: Optional[float] = None
    end: Optional[float] = None
    similarity: Optional[float] = None
    video_duration: Optional[float] = None


class ChatRequest(BaseModel):
    question: str = Field("", max_length=settings.max_question_chars)
    mode: Mode = "ask"
    conversation_id: Optional[int] = None
    video_id: Optional[int] = None
    top_k: Optional[int] = Field(None, ge=1, le=20)


class MessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
    sources: List[Source] = []
    cost_usd: Optional[float] = None
    cache_hit: bool = False


class ConversationItem(BaseModel):
    id: int
    title: Optional[str]
    video_id: Optional[int]
    video_title: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(ConversationItem):
    messages: List[MessageItem] = []


class UsageSummary(BaseModel):
    questions_asked: int
    cache_hits: int
    total_cost_usd: float
    quota: dict
