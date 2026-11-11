"""Chat request and response models."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from api.config import settings


class Source(BaseModel):
    """One cited passage: from a lecture (timestamps) or a document (page or slide)."""

    kind: Literal["video", "document"] = "video"
    chunk_id: Optional[int] = None
    video_id: Optional[int] = None
    text: str
    # "12:04 - 13:19" for a lecture; "p. 4", "slide 4" or "" for a document.
    timestamp: str
    # The source's display name: the lecture title, or the document title.
    video: str
    start: Optional[float] = None
    end: Optional[float] = None
    similarity: Optional[float] = None
    video_duration: Optional[float] = None
    document_id: Optional[int] = None
    document_title: Optional[str] = None
    page: Optional[int] = None
    url: Optional[str] = None
    # How the answer cites a document passage, such as "Doc 3".
    ref: Optional[str] = None


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    model: str = ""
    cost_usd: float = 0.0


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=settings.max_question_chars)
    conversation_id: Optional[int] = None
    video_id: Optional[int] = None
    # With scope "workspace", a null workspace_id means the Unsorted lectures.
    workspace_id: Optional[int] = None
    # What a new conversation searches. Left out, it is "video" when video_id
    # is given and "all" otherwise, which is how chats worked before subjects.
    # Ignored when conversation_id is given: a thread keeps its scope.
    scope: Optional[Literal["video", "workspace", "all"]] = None
    top_k: Optional[int] = Field(None, ge=1, le=20)


class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int
    answer: str
    sources: List[Source]
    response_time: float
    num_sources: int
    usage: Optional[Usage] = None
    cache_hit: bool = False


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
    scope: str
    video_id: Optional[int]
    workspace_id: Optional[int] = None
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
    total_input_tokens: int
    total_output_tokens: int
    model: str
    quota: dict
    # Indexed passages (lectures and imported material) against the plan's allowance.
    content: dict
