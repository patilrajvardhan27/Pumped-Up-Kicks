"""Study guide, practice set and deadline response models."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# --- schemas ----------------------------------------------------------------


class KeyTerm(BaseModel):
    term: str
    definition: str
    start: Optional[float] = None


class OutlineEntry(BaseModel):
    start: float
    title: str


class StudyGuideInfo(BaseModel):
    video_id: int
    summary: str
    key_terms: List[KeyTerm]
    outline: List[OutlineEntry]
    covered_until_s: Optional[float] = None
    cost_usd: Optional[float] = None
    created_at: str


class StudyGuideResponse(BaseModel):
    """`guide` is null until one has been made."""
    guide: Optional[StudyGuideInfo] = None


class PracticeRequest(BaseModel):
    kind: Literal["questions", "flashcards"]
    count: int = Field(8, ge=3, le=20)
    # Optional topic to draw from; without one the set spreads across the subject.
    focus: Optional[str] = Field(None, max_length=200)


class StudySetInfo(BaseModel):
    id: int
    workspace_id: int
    kind: str
    focus: Optional[str] = None
    items: List[dict]
    cost_usd: Optional[float] = None
    created_at: str


class DeadlineInfo(BaseModel):
    id: int
    workspace_id: Optional[int] = None
    title: str
    due_at: str
    url: Optional[str] = None
    points_possible: Optional[float] = None
    is_quiz: bool
