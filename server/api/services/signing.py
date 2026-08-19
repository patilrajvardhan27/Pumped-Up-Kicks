"""
Short-lived signed URLs for media the browser fetches directly.

A `<video>` element cannot send an Authorization header, so a locally-served
lecture needs its permission carried in the URL instead. This is the same idea
as an R2 presigned URL, done for the local backend: an HMAC over the object key
and an expiry, scoped to the user who asked for it.
"""
import hashlib
import hmac
import time
from typing import Optional

from api.config import settings


class SignatureError(Exception):
    """Raised when a media token is missing, malformed, expired, or forged."""


def _digest(storage_key: str, user_id: str, expires_at: int) -> str:
    message = f"{storage_key}:{user_id}:{expires_at}".encode("utf-8")
    return hmac.new(settings.secret_key.encode("utf-8"), message, hashlib.sha256).hexdigest()


def sign(storage_key: str, user_id: str, ttl_seconds: Optional[int] = None) -> str:
    """Build a token granting one user read access to one object for a while."""
    expires_at = int(time.time()) + (ttl_seconds or settings.presign_expiry_seconds)
    return f"{user_id}.{expires_at}.{_digest(storage_key, user_id, expires_at)}"


def verify(token: str, storage_key: str) -> str:
    """
    Check a token against the object it claims to grant, returning the user id.

    Raises SignatureError rather than returning a boolean so a caller cannot
    accidentally treat a falsy result as success.
    """
    if not token:
        raise SignatureError("This link is missing its access token.")

    try:
        user_id, expires_raw, provided = token.rsplit(".", 2)
        expires_at = int(expires_raw)
    except (ValueError, AttributeError):
        raise SignatureError("This link is malformed.")

    if expires_at < time.time():
        raise SignatureError("This link has expired. Reload the page.")

    # Constant-time comparison so a wrong signature leaks no timing information.
    if not hmac.compare_digest(provided, _digest(storage_key, user_id, expires_at)):
        raise SignatureError("This link is not valid.")

    return user_id
