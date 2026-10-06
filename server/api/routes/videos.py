"""Video library: presigned uploads, processing status, playback, deletion."""
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Video, get_session
from api.services.signing import SignatureError, sign, verify
from api.services.storage import get_storage, safe_key
from api.services.video_processor import STAGE_LABELS, process_video

router = APIRouter(prefix="/api/videos", tags=["videos"])

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
CONTENT_TYPES = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
    ".mkv": "video/x-matroska", ".webm": "video/webm", ".avi": "video/x-msvideo",
}


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
    num_segments: Optional[int] = None
    num_chunks: Optional[int] = None


class VideoListResponse(BaseModel):
    total: int
    videos: List[VideoInfo]


class PresignRequest(BaseModel):
    filename: str
    content_type: Optional[str] = None
    title: Optional[str] = None
    file_size: Optional[int] = None


class PresignResponse(BaseModel):
    """When upload_url is null the client posts to /upload instead."""
    video_id: int
    upload_url: Optional[str]
    storage_key: str
    method: str


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


def _to_info(video: Video) -> VideoInfo:
    return VideoInfo(
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
        num_segments=video.num_segments,
        num_chunks=video.num_chunks,
    )


def _validate_filename(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or filename}'. "
                   f"Use one of: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


def _claim_filename(ctx: RequestContext, filename: str) -> None:
    existing = (
        ctx.db.query(Video)
        .filter(Video.user_id == ctx.user_id, Video.filename == filename)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"You already have a lecture named '{filename}'. "
                   "Rename it, or delete the existing one.",
        )


# --- background work --------------------------------------------------------


def run_pipeline(video_id: int) -> None:
    """Runs after the response is sent, on its own session."""
    db = get_session()
    video = None
    try:
        video = db.get(Video, video_id)
        if video is None:
            print(f"[Pipeline] video {video_id} vanished before processing")
            return

        def on_stage(stage: str, progress: int, extra: dict):
            video.stage = stage
            video.progress = progress
            if extra.get("duration"):
                video.duration_s = extra["duration"]
            if extra.get("num_segments") is not None:
                video.num_segments = extra["num_segments"]
            if extra.get("num_chunks") is not None:
                video.num_chunks = extra["num_chunks"]
            if stage == "failed":
                video.error_message = extra.get("error")
            elif stage == "ready":
                video.error_message = None
            db.commit()
            print(f"[Pipeline] video={video_id} stage={stage} {progress}%")

        process_video(db, video, on_stage=on_stage)

    except Exception as e:
        import traceback
        traceback.print_exc()
        if video is not None:
            video.stage = "failed"
            video.progress = 100
            video.error_message = str(e)
            db.commit()
    finally:
        db.close()


# --- routes -----------------------------------------------------------------


@router.get("", response_model=VideoListResponse)
def list_videos(limit: int = 50, ctx: RequestContext = Ctx):
    videos = (
        ctx.db.query(Video)
        .filter(Video.user_id == ctx.user_id)
        .order_by(Video.created_at.desc())
        .limit(limit)
        .all()
    )
    return VideoListResponse(total=len(videos), videos=[_to_info(v) for v in videos])


def _owned_video(ctx: RequestContext, video_id: int) -> Video:
    video = (
        ctx.db.query(Video)
        .filter(Video.id == video_id, Video.user_id == ctx.user_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.post("/presign", response_model=PresignResponse)
def presign_upload(request: PresignRequest, ctx: RequestContext = Ctx):
    """
    Reserve a library slot and hand back a URL to upload to.

    On R2 the browser PUTs straight to storage, so a 4 GB lecture never passes
    through this server.
    """
    ext = _validate_filename(request.filename)
    _claim_filename(ctx, request.filename)

    if request.file_size and request.file_size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"That file is larger than the "
                   f"{settings.max_upload_bytes // (1024 ** 3)} GB limit.",
        )

    key = safe_key(ctx.user_id, request.filename)
    content_type = request.content_type or CONTENT_TYPES.get(ext, "application/octet-stream")

    video = Video(
        user_id=ctx.user_id,
        filename=request.filename,
        title=request.title or request.filename,
        storage_key=key,
        file_size=request.file_size,
        stage="queued",
        progress=0,
    )
    ctx.db.add(video)
    ctx.db.commit()
    ctx.db.refresh(video)

    upload_url = get_storage().presign_upload(key, content_type)

    return PresignResponse(
        video_id=video.id,
        upload_url=upload_url,
        storage_key=key,
        method="PUT" if upload_url else "POST",
    )


@router.post("/{video_id}/complete", response_model=UploadResponse)
def complete_upload(
    video_id: int, background_tasks: BackgroundTasks, ctx: RequestContext = Ctx
):
    """Called once the browser's direct upload finishes. Starts processing."""
    video = _owned_video(ctx, video_id)
    storage = get_storage()

    if not storage.exists(video.storage_key):
        raise HTTPException(
            status_code=400,
            detail="The upload didn't arrive in storage. Try uploading again.",
        )

    if video.file_size is None:
        video.file_size = storage.size(video.storage_key)

    video.stage = "queued"
    video.progress = 0
    ctx.db.commit()

    background_tasks.add_task(run_pipeline, video.id)

    return UploadResponse(
        message=f"'{video.filename}' uploaded. Transcription starts now.",
        video_id=video.id,
        filename=video.filename,
        status="queued",
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    ctx: RequestContext = Ctx,
):
    """
    Direct upload through the API. Used by the local backend, and as a fallback
    when presigning isn't available.
    """
    _validate_filename(file.filename)
    _claim_filename(ctx, file.filename)

    key = safe_key(ctx.user_id, file.filename)
    storage = get_storage()

    written = storage.save_stream(key, file.file)

    if written > settings.max_upload_bytes:
        storage.delete(key)
        raise HTTPException(
            status_code=413,
            detail=f"That file is larger than the "
                   f"{settings.max_upload_bytes // (1024 ** 3)} GB limit.",
        )

    video = Video(
        user_id=ctx.user_id,
        filename=file.filename,
        title=title or file.filename,
        storage_key=key,
        file_size=written,
        stage="queued",
        progress=0,
    )
    ctx.db.add(video)
    ctx.db.commit()
    ctx.db.refresh(video)

    background_tasks.add_task(run_pipeline, video.id)

    return UploadResponse(
        message=f"'{file.filename}' uploaded. Transcription starts now.",
        video_id=video.id,
        filename=file.filename,
        status="queued",
    )


@router.get("/{video_id}", response_model=VideoInfo)
def get_video(video_id: int, ctx: RequestContext = Ctx):
    return _to_info(_owned_video(ctx, video_id))


@router.get("/{video_id}/status", response_model=VideoInfo)
def get_video_status(video_id: int, ctx: RequestContext = Ctx):
    """Polled by the client while a lecture is being prepared."""
    video = _owned_video(ctx, video_id)
    ctx.db.refresh(video)
    return _to_info(video)


@router.get("/{video_id}/playback", response_model=PlaybackResponse)
def playback_url(request: Request, video_id: int, ctx: RequestContext = Ctx):
    """
    A time-limited URL the player can stream from, so a citation can seek to it.

    On R2 this is a presigned URL. Locally it is a signed link to /file/... —
    either way the credential travels in the URL, because a <video> element
    cannot send an Authorization header.
    """
    video = _owned_video(ctx, video_id)
    ext = Path(video.filename).suffix.lower()

    if settings.storage_backend == "local":
        token = sign(video.storage_key, ctx.user_id)
        url = str(
            request.url_for("serve_local_file", storage_key=video.storage_key)
            .include_query_params(token=token)
        )
    else:
        url = get_storage().presign_download(video.storage_key)

    return PlaybackResponse(
        url=url,
        expires_in=settings.presign_expiry_seconds,
        duration=video.duration_s,
        content_type=CONTENT_TYPES.get(ext, "video/mp4"),
    )


@router.get("/file/{storage_key:path}", name="serve_local_file")
def serve_local_file(storage_key: str, token: str = ""):
    """
    Streams a lecture from the local backend.

    Authenticated by the signed `token` rather than a header, since this URL is
    loaded by the browser's media element. Starlette's FileResponse answers
    Range requests, which is what makes seeking work.
    """
    try:
        user_id = verify(token, storage_key)
    except SignatureError as e:
        raise HTTPException(status_code=403, detail=str(e))

    db = get_session()
    try:
        video = (
            db.query(Video)
            .filter(Video.storage_key == storage_key, Video.user_id == user_id)
            .first()
        )
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        filename = video.filename
    finally:
        db.close()

    storage = get_storage()
    if settings.storage_backend != "local":
        return RedirectResponse(storage.presign_download(storage_key))

    path = storage.local_path(storage_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File is missing from storage")

    ext = Path(filename).suffix.lower()
    return FileResponse(path, media_type=CONTENT_TYPES.get(ext, "video/mp4"))


@router.delete("/{video_id}")
def delete_video(video_id: int, ctx: RequestContext = Ctx):
    """Removes the object, its chunks, and any conversations about it."""
    video = _owned_video(ctx, video_id)
    filename = video.filename

    try:
        get_storage().delete(video.storage_key)
    except Exception as e:
        print(f"[Delete] Could not remove object {video.storage_key}: {e}")

    # Chunks and conversations cascade from the foreign keys.
    ctx.db.delete(video)
    ctx.db.commit()

    return {"message": f"'{filename}' deleted."}
