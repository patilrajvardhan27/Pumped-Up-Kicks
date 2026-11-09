"""
Removing what lives outside the database. Rows cascade from their foreign
keys; files and third-party grants do not, so every delete path calls these.
"""
import logging

from api.models.database import CanvasConnection, Video
from api.services import canvas_auth
from api.services.canvas_auth import CanvasAuthError
from api.services.storage import get_storage
from api.services.video_processor import transcript_path

log = logging.getLogger(__name__)


def purge_video_files(video: Video) -> None:
    """
    Delete a lecture's stored file and local transcript. The privacy policy
    promises both go when a lecture or an account is deleted, so failures are
    logged rather than silently skipped.
    """
    try:
        get_storage().delete(video.storage_key)
    except Exception as e:
        log.warning("Could not remove object %s: %s", video.storage_key, e)
    try:
        transcript_path(video.storage_key).unlink(missing_ok=True)
    except OSError as e:
        log.warning("Could not remove transcript for %s: %s", video.storage_key, e)


def revoke_canvas(connection: CanvasConnection) -> None:
    """Revoke an OAuth grant at Canvas, best effort. Personal tokens are the user's to revoke."""
    if connection.auth_type != "oauth":
        return
    try:
        canvas_auth.revoke(connection.base_url, canvas_auth.decrypt_token(connection.access_token_enc))
    except CanvasAuthError:
        log.info("Canvas grant for %s could not be revoked; it expires on its own", connection.user_id)
