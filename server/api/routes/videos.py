from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from pathlib import Path
import shutil

from api.models.database import get_db, Video

router = APIRouter(prefix="/api/videos", tags=["videos"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)


class VideoInfo(BaseModel):
    id: int
    filename: str
    title: Optional[str]
    duration: Optional[float]
    uploaded_at: str
    transcription_status: str
    embedding_status: str
    file_size: Optional[int]

    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    total: int
    videos: List[VideoInfo]


class UploadResponse(BaseModel):
    message: str
    video_id: int
    filename: str
    status: str


@router.get("", response_model=VideoListResponse)
async def list_videos(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Video)

        if status:
            query = query.filter(Video.transcription_status == status)

        videos = query.order_by(Video.uploaded_at.desc()).limit(limit).all()

        return VideoListResponse(
            total=len(videos),
            videos=[
                VideoInfo(
                    id=v.id,
                    filename=v.filename,
                    title=v.title or v.filename,
                    duration=v.duration,
                    uploaded_at=v.uploaded_at.isoformat(),
                    transcription_status=v.transcription_status,
                    embedding_status=v.embedding_status,
                    file_size=v.file_size
                )
                for v in videos
            ]
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing videos: {str(e)}"
        )


@router.get("/{video_id}", response_model=VideoInfo)
async def get_video(video_id: int, db: Session = Depends(get_db)):
    try:
        video = db.query(Video).filter(Video.id == video_id).first()

        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        return VideoInfo(
            id=video.id,
            filename=video.filename,
            title=video.title or video.filename,
            duration=video.duration,
            uploaded_at=video.uploaded_at.isoformat(),
            transcription_status=video.transcription_status,
            embedding_status=video.embedding_status,
            file_size=video.file_size
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting video: {str(e)}"
        )


@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        allowed_extensions = {'.mp4', '.avi', '.mov', '.mkv'}
        file_ext = Path(file.filename).suffix.lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )

        existing = db.query(Video).filter(Video.filename == file.filename).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Video '{file.filename}' already exists"
            )

        file_path = UPLOAD_DIR / file.filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = file_path.stat().st_size

        video = Video(
            filename=file.filename,
            title=title or file.filename,
            video_path=str(file_path),
            file_size=file_size,
            transcription_status="pending",
            embedding_status="pending"
        )

        db.add(video)
        db.commit()
        db.refresh(video)

        return UploadResponse(
            message=f"Video '{file.filename}' uploaded successfully",
            video_id=video.id,
            filename=file.filename,
            status="pending"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading video: {str(e)}"
        )
