"""Video library: presigned uploads, processing status, playback, deletion."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from api.config import settings
from api.deps import Ctx, RequestContext
from api.models.database import Conversation, Video
from api.routes.workspaces import owned_workspace
from api.schemas.videos import (
    MoveRequest,
    PresignRequest,
    PresignResponse,
    UploadResponse,
    VideoInfo,
    VideoListResponse,
    to_info,
)
from api.services.cleanup import purge_video_files
from api.services.pipeline import run_pipeline
from api.services.ratelimit import rate_limit
from api.services.storage import UploadTooLarge, get_storage, safe_key
from api.services.uploads import (
    CONTENT_TYPES,
    claim_filename,
    discard,
    owned_video,
    too_large,
    validate_filename,
)

router = APIRouter(prefix="/api/videos", tags=["videos"])


@router.get("", response_model=VideoListResponse)
def list_videos(limit: int = Query(50, ge=1, le=100), ctx: RequestContext = Ctx):
    videos = (
        ctx.db.query(Video)
        .filter(Video.user_id == ctx.user_id)
        .order_by(Video.created_at.desc())
        .limit(limit)
        .all()
    )
    return VideoListResponse(total=len(videos), videos=[to_info(v) for v in videos])


@router.post(
    "/presign",
    response_model=PresignResponse,
    dependencies=[rate_limit("upload", settings.rate_limit_upload_per_minute)],
)
def presign_upload(request: PresignRequest, ctx: RequestContext = Ctx):
    """
    Reserve a library slot and hand back a URL to upload to.

    On R2 the browser PUTs straight to storage, so a 4 GB lecture never passes
    through this server.
    """
    ext = validate_filename(request.filename)
    claim_filename(ctx, request.filename)
    if request.workspace_id is not None:
        owned_workspace(ctx, request.workspace_id)

    if request.file_size and request.file_size > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=too_large())

    if settings.storage_backend == "r2" and not request.file_size:
        raise HTTPException(status_code=400, detail="The file size is needed to start an upload.")

    key = safe_key(ctx.user_id, request.filename)
    content_type = request.content_type or CONTENT_TYPES.get(ext, "application/octet-stream")

    video = Video(
        user_id=ctx.user_id,
        workspace_id=request.workspace_id,
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

    upload_url = get_storage().presign_upload(key, content_type, request.file_size)

    return PresignResponse(
        video_id=video.id,
        upload_url=upload_url,
        method="PUT" if upload_url else "POST",
    )


@router.post("/{video_id}/complete", response_model=UploadResponse)
def complete_upload(
    video_id: int, background_tasks: BackgroundTasks, ctx: RequestContext = Ctx
):
    """Called once the browser's direct upload finishes. Starts processing."""
    video = owned_video(ctx, video_id)
    storage = get_storage()

    if not storage.exists(video.storage_key):
        raise HTTPException(
            status_code=400,
            detail="The upload didn't arrive in storage. Try uploading again.",
        )

    actual = storage.size(video.storage_key)
    if actual is not None and actual > settings.max_upload_bytes:
        discard(ctx, video)
        raise HTTPException(status_code=413, detail=too_large())
    if video.file_size is None:
        video.file_size = actual

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


@router.post(
    "/upload",
    response_model=UploadResponse,
    dependencies=[rate_limit("upload", settings.rate_limit_upload_per_minute)],
)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None, max_length=settings.max_title_chars),
    workspace_id: Optional[int] = Form(None),
    ctx: RequestContext = Ctx,
):
    """
    Direct upload through the API. Used by the local backend, and as a fallback
    when presigning isn't available.
    """
    validate_filename(file.filename)
    claim_filename(ctx, file.filename)
    if workspace_id is not None:
        owned_workspace(ctx, workspace_id)

    key = safe_key(ctx.user_id, file.filename)
    storage = get_storage()

    try:
        written = await run_in_threadpool(
            storage.save_stream, key, file.file, settings.max_upload_bytes
        )
    except UploadTooLarge:
        raise HTTPException(status_code=413, detail=too_large())

    video = Video(
        user_id=ctx.user_id,
        workspace_id=workspace_id,
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
    return to_info(owned_video(ctx, video_id))


@router.get("/{video_id}/status", response_model=VideoInfo)
def get_video_status(video_id: int, ctx: RequestContext = Ctx):
    """Polled by the client while a lecture is being prepared."""
    video = owned_video(ctx, video_id)
    ctx.db.refresh(video)
    return to_info(video)


@router.put("/{video_id}/workspace", response_model=VideoInfo)
def move_video(video_id: int, request: MoveRequest, ctx: RequestContext = Ctx):
    """File a lecture under another subject, or under none (Unsorted)."""
    video = owned_video(ctx, video_id)
    if request.workspace_id is not None:
        owned_workspace(ctx, request.workspace_id)

    video.workspace_id = request.workspace_id

    # Threads about this one lecture are filed with it, so they move too. Their
    # updated_at is kept, so a move does not reshuffle the recent chats.
    ctx.db.query(Conversation).filter(
        Conversation.user_id == ctx.user_id,
        Conversation.video_id == video.id,
        Conversation.scope == "video",
    ).update(
        {
            Conversation.workspace_id: request.workspace_id,
            Conversation.updated_at: Conversation.updated_at,
        },
        synchronize_session=False,
    )
    ctx.db.commit()
    ctx.db.refresh(video)
    return to_info(video)


@router.delete("/{video_id}")
def delete_video(video_id: int, ctx: RequestContext = Ctx):
    """Removes the object, its chunks, and any conversations about it."""
    video = owned_video(ctx, video_id)
    filename = video.filename

    purge_video_files(video)

    # Chunks and conversations cascade from the foreign keys.
    ctx.db.delete(video)
    ctx.db.commit()

    return {"message": f"'{filename}' deleted."}
