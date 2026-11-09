"""
Playback. A `<video>` element cannot send an Authorization header, so the
permission travels in a short-lived signed URL instead.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from api.config import settings
from api.deps import Ctx, RequestContext, owned
from api.models.database import Video, get_session
from api.schemas.videos import PlaybackResponse
from api.services.signing import SignatureError, sign, verify
from api.services.storage import get_storage
from api.services.uploads import content_type_for

router = APIRouter(prefix="/api/videos", tags=["media"])


@router.get("/{video_id}/playback", response_model=PlaybackResponse)
def playback_url(request: Request, video_id: int, ctx: RequestContext = Ctx):
    """
    A time-limited URL the player can stream from, so a citation can seek to it.

    On R2 this is a presigned URL. Locally it is a signed link to /file/...,
    scoped to one object, one user and one expiry.
    """
    video = owned(ctx, Video, video_id, "Video")

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
        content_type=content_type_for(video.filename),
    )


@router.get("/file/{storage_key:path}", name="serve_local_file")
def serve_local_file(storage_key: str, token: str = ""):
    """
    Streams a lecture from the local backend.

    Authenticated by the signed `token` rather than a header. Starlette's
    FileResponse answers Range requests, which is what makes seeking work.
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

    return FileResponse(path, media_type=content_type_for(filename))
