from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from api.models.database import get_db, ChatHistory
from api.services.lecture_rag_service import get_rag_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


class Source(BaseModel):
    text: str
    timestamp: str
    video: str
    start: Optional[float] = None
    end: Optional[float] = None
    similarity: Optional[float] = None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    video_id: Optional[str] = Field(None)
    session_id: Optional[str] = Field(None)
    top_k: Optional[int] = Field(5, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
    response_time: float
    num_sources: int


class HistoryItem(BaseModel):
    id: int
    query: str
    answer: str
    created_at: str
    response_time: Optional[float]
    num_sources: Optional[int]


class HealthResponse(BaseModel):
    status: str
    documents_indexed: int
    embedding_model: str
    llm_model: str
    vector_store: str


@router.post("/query", response_model=ChatResponse)
async def chat_query(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        rag_service = get_rag_service()

        result = rag_service.query(
            question=request.question,
            video_filter=request.video_id,
            top_k=request.top_k
        )

        chat_entry = ChatHistory(
            query=request.question,
            answer=result["answer"],
            session_id=request.session_id,
            response_time=result.get("response_time"),
            num_sources=result.get("num_sources")
        )
        db.add(chat_entry)
        db.commit()

        return ChatResponse(
            answer=result["answer"],
            sources=[Source(**src) for src in result["sources"]],
            response_time=result["response_time"],
            num_sources=result["num_sources"]
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error processing query: {str(e)}"
        )


@router.get("/history", response_model=List[HistoryItem])
async def get_history(
    limit: int = 10,
    session_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(ChatHistory)

        if session_id:
            query = query.filter(ChatHistory.session_id == session_id)

        history = query.order_by(ChatHistory.created_at.desc()).limit(limit).all()

        return [
            HistoryItem(
                id=item.id,
                query=item.query,
                answer=item.answer,
                created_at=item.created_at.isoformat(),
                response_time=item.response_time,
                num_sources=item.num_sources
            )
            for item in history
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching history: {str(e)}"
        )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        rag_service = get_rag_service()
        stats = rag_service.get_stats()

        if stats.get("status") == "error":
            raise HTTPException(
                status_code=503,
                detail=f"RAG system unhealthy: {stats.get('error')}"
            )

        return HealthResponse(**stats)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Health check failed: {str(e)}"
        )
