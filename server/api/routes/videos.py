from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import time

from api.models.database import get_db, Video
from api.services.video_processor import get_video_processor

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


TRANSCRIPTION_DIR = Path("data/transcriptions")


@router.delete("/{video_id}")
async def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    filename = video.filename
    stem = Path(filename).stem

    # Delete uploaded video file
    upload_path = UPLOAD_DIR / filename
    if upload_path.exists():
        upload_path.unlink()

    # Delete transcription files (e.g. video_segments.json, video.txt, etc.)
    if TRANSCRIPTION_DIR.exists():
        for f in TRANSCRIPTION_DIR.glob(f"{stem}*"):
            f.unlink()

    # Remove entries from FAISS vector store
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))
        from services.embeddings.vector_store import VectorStore
        store = VectorStore()
        source_file = f"{stem}_segments.json"
        store.delete_by_metadata("source_file", source_file)
    except Exception as e:
        print(f"[Delete] Warning: could not clean vector store: {e}")

    # Delete DB record
    db.delete(video)
    db.commit()

    return {"message": f"Video '{filename}' deleted successfully"}


def process_video_background(video_id: int, video_path: str, db_path: str = "data/app.db"):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from api.models.database import Video

    print(f"\n{'='*60}")
    print(f"[Processing] Background task started for video {video_id}")
    print(f"[Processing] Path: {video_path}")
    print(f"{'='*60}")
    total_start = time.time()

    processor = get_video_processor()

    engine = create_engine(f"sqlite:///{db_path}")
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            print(f"[Processing] Video {video_id} not found in DB, aborting")
            return

        video.transcription_status = "processing"
        db.commit()
        print(f"[Processing] Status set to 'processing'")

        result = processor.process_video(video_path, video_id)

        total_elapsed = time.time() - total_start
        overall_status = result.get("overall_status", result.get("status", "error"))

        if overall_status == "success":
            video.transcription_status = "completed"
            video.embedding_status = "completed"
            print(f"\n[Processing] Video {video_id} completed successfully in {total_elapsed:.1f}s")
        else:
            video.transcription_status = "failed"
            video.embedding_status = "failed"
            error_msg = result.get("message", "Processing failed")
            video.error_message = error_msg
            print(f"\n[Processing] Video {video_id} FAILED after {total_elapsed:.1f}s: {error_msg}")

        db.commit()

    except Exception as e:
        print(f"[Processing] EXCEPTION for video {video_id}: {e}")
        import traceback
        traceback.print_exc()
        if video:
            video.transcription_status = "failed"
            video.embedding_status = "failed"
            db.commit()
    finally:
        db.close()
        print(f"{'='*60}\n")

@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
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
        print(f"\n[Upload] Saving file: {file.filename}")
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = file_path.stat().st_size
        print(f"[Upload] File saved ({file_size / (1024*1024):.1f} MB)")

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

        print(f"[Upload] Video record created (id={video.id})")
        print(f"[Upload] Starting background processing...")

        background_tasks.add_task(
            process_video_background,
            video.id,
            str(file_path)
        )

        return UploadResponse(
            message=f"Video '{file.filename}' uploaded successfully. Processing started.",
            video_id=video.id,
            filename=file.filename,
            status="processing"
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
