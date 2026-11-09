"""Video library: uploads, processing status, transcripts and deletion."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile

from api.config import settings
from api.deps import Ctx, RequestContext, owned
from api.models.database import Video
from api.schemas.videos import (
    PresignRequest,
    PresignResponse,
    TranscriptLine,
    TranscriptResponse,
    UploadResponse,
    VideoInfo,
    VideoListResponse,
)
from api.services.lecture_rag_service import get_rag_service
from api.services.pipeline import purge_files, run_pipeline
from api.services.ratelimit import rate_limit
from api.services.storage import get_storage, safe_key
from api.services.uploads import check_size, claim_filename, validate_filename

router = APIRouter(prefix="/api/videos", tags=["videos"])

upload_limit = rate_limit("upload", settings.rate_limit_upload_per_minute)


def _create(ctx: RequestContext, filename: str, title: Optional[str], size: Optional[int]) -> Video:
    video = Video(
        user_id=ctx.user_id,
        filename=filename,
        title=title or filename,
        storage_key=safe_key(ctx.user_id, filename),
        file_size=size,
        stage="queued",
        progress=0,
    )
    ctx.db.add(video)
    ctx.db.commit()
    ctx.db.refresh(video)
    return video


def _queued(video: Video, background_tasks: BackgroundTasks) -> UploadResponse:
    background_tasks.add_task(run_pipeline, video.id)
    return UploadResponse(
        message=f"'{video.filename}' uploaded. Transcription starts now.",
        video_id=video.id,
        filename=video.filename,
        status="queued",
    )


@router.get("", response_model=VideoListResponse)
def list_videos(limit: int = Query(50, ge=1, le=200), ctx: RequestContext = Ctx):
    videos = (
        ctx.db.query(Video)
        .filter(Video.user_id == ctx.user_id)
        .order_by(Video.created_at.desc())
        .limit(limit)
        .all()
    )
    return VideoListResponse(total=len(videos), videos=[VideoInfo.of(v) for v in videos])


@router.post("/presign", response_model=PresignResponse, dependencies=[upload_limit])
def presign_upload(request: PresignRequest, ctx: RequestContext = Ctx):
    """
    Reserve a library slot and hand back a URL to upload to.

    On R2 the browser PUTs straight to storage, so a 4 GB lecture never passes
    through this server. The size the browser reports is only a first check;
    /complete measures the stored object.
    """
    content_type = validate_filename(request.filename)
    check_size(request.file_size)
    claim_filename(ctx, request.filename)

    video = _create(ctx, request.filename, request.title, request.file_size)
    return PresignResponse(
        video_id=video.id,
        upload_url=get_storage().presign_upload(video.storage_key, content_type),
        content_type=content_type,
    )


@router.post("/{video_id}/complete", response_model=UploadResponse)
def complete_upload(video_id: int, background_tasks: BackgroundTasks, ctx: RequestContext = Ctx):
    """Called once the browser's direct upload finishes. Starts processing."""
    video = owned(ctx, Video, video_id, "Video")
    storage = get_storage()

    size = storage.size(video.storage_key)
    if size is None:
        raise HTTPException(status_code=400, detail="The upload didn't arrive in storage. Try uploading again.")
    try:
        check_size(size)
    except HTTPException:
        # A presigned PUT cannot cap its own size, so an oversized object is caught here.
        purge_files(video)
        ctx.db.delete(video)
        ctx.db.commit()
        raise

    video.file_size = size
    video.stage, video.progress = "queued", 0
    ctx.db.commit()
    return _queued(video, background_tasks)


@router.post("/upload", response_model=UploadResponse, dependencies=[upload_limit])
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None, max_length=settings.max_title_chars),
    ctx: RequestContext = Ctx,
):
    """Direct upload through the API, used by the local storage backend."""
    validate_filename(file.filename)
    claim_filename(ctx, file.filename)

    key = safe_key(ctx.user_id, file.filename)
    storage = get_storage()
    written = storage.save_stream(key, file.file)
    try:
        check_size(written)
    except HTTPException:
        storage.delete(key)
        raise

    return _queued(_create(ctx, file.filename, title, written), background_tasks)


@router.get("/{video_id}", response_model=VideoInfo)
def get_video(video_id: int, ctx: RequestContext = Ctx):
    return VideoInfo.of(owned(ctx, Video, video_id, "Video"))


@router.get("/{video_id}/transcript", response_model=TranscriptResponse)
def get_transcript(video_id: int, ctx: RequestContext = Ctx):
    """The lecture as readable text with timestamps. Costs no AI tokens."""
    video = owned(ctx, Video, video_id, "Video")
    lines = get_rag_service().transcript(ctx.db, ctx.user_id, video.id)
    return TranscriptResponse(
        video_id=video.id,
        title=video.title or video.filename,
        lines=[TranscriptLine(**line) for line in lines],
    )


@router.delete("/{video_id}")
def delete_video(video_id: int, ctx: RequestContext = Ctx):
    """Removes the file, its transcript, its chunks and any chats about it."""
    video = owned(ctx, Video, video_id, "Video")
    filename = video.filename
    purge_files(video)
    ctx.db.delete(video)  # chunks and conversations cascade from the foreign keys
    ctx.db.commit()
    return {"message": f"'{filename}' deleted."}
