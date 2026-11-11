"""
Encrypting Canvas tokens at rest, and the error every Canvas sign-in step raises.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from api.config import settings

# Read-only. These are the scopes a school admin ticks on the developer key
# when "Enforce scopes" is on; docs/SETUP.md lists them for the admin. Quizzes,
# submissions, grades and other people are deliberately not here.


class CanvasAuthError(Exception):
    """A sign-in step failed. The message is safe to show and contains no secrets."""


_warned_derived_key = False


def _fernet() -> MultiFernet:
    global _warned_derived_key
    keys = [k.strip() for k in (settings.canvas_token_key or "").split(",") if k.strip()]
    if not keys:
        if settings.auth_mode != "dev":
            raise CanvasAuthError("Canvas is not configured on this server (CANVAS_TOKEN_KEY is missing).")
        # Development only: a key derived from SECRET_KEY, so a laptop works
        # with nothing configured. config.py requires a real key otherwise.
        if not _warned_derived_key:
            print("[Canvas] CANVAS_TOKEN_KEY not set; using a development key derived from SECRET_KEY")
            _warned_derived_key = True
        digest = hashlib.sha256(b"canvas-token-key:" + settings.secret_key.encode("utf-8")).digest()
        keys = [base64.urlsafe_b64encode(digest).decode("ascii")]
    try:
        return MultiFernet([Fernet(key) for key in keys])
    except ValueError:
        raise CanvasAuthError("CANVAS_TOKEN_KEY is not a valid Fernet key.") from None


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(blob: str) -> str:
    try:
        return _fernet().decrypt(blob.encode("ascii")).decode("utf-8")
    except InvalidToken:
        raise CanvasAuthError("The stored Canvas sign-in can't be read. Connect Canvas again.") from None
