"""
Canvas sign-in, and the tokens it produces.

The real path is OAuth2 against the student's own school: each school's Canvas
admin issues a developer key (client id and secret) for this app, listed in
CANVAS_OAUTH_CLIENTS. A personal access token can be used instead only when
CANVAS_ALLOW_PERSONAL_TOKENS is on, which config.py refuses outside dev mode.

Tokens are encrypted with Fernet before they reach the database, are never
returned to the client, and never appear in a log line or an error message.
The OAuth `state` is signed and names the user who started the flow, so the
callback (a plain browser redirect, with no Authorization header) knows whose
connection it is completing and cannot be replayed for someone else.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from api.config import settings
from api.services import net_guard

# Read-only. These are the scopes a school admin ticks on the developer key
# when "Enforce scopes" is on; docs/SETUP.md lists them for the admin. Quizzes,
# submissions, grades and other people are deliberately not here.
SCOPES = (
    "url:GET|/api/v1/users/:id",
    "url:GET|/api/v1/courses",
    "url:GET|/api/v1/courses/:id",
    "url:GET|/api/v1/courses/:course_id/files",
    "url:GET|/api/v1/courses/:course_id/pages",
    "url:GET|/api/v1/courses/:course_id/pages/:url_or_id",
    "url:GET|/api/v1/courses/:course_id/modules",
    "url:GET|/api/v1/courses/:course_id/assignments",
    "url:GET|/api/v1/courses/:course_id/discussion_topics",
)

STATE_TTL_SECONDS = 600
REFRESH_MARGIN = timedelta(minutes=2)


def http_factory() -> httpx.Client:
    """How sign-in calls reach Canvas. Tests swap this for recorded responses."""
    return net_guard.guarded_client(timeout=30)


class CanvasAuthError(Exception):
    """A sign-in step failed. The message is safe to show and contains no secrets."""


# --- encryption at rest -------------------------------------------------------

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


# --- OAuth state --------------------------------------------------------------


def _state_signature(payload: str) -> str:
    key = hmac.new(settings.secret_key.encode("utf-8"), b"canvas-oauth-state", hashlib.sha256).digest()
    return hmac.new(key, payload.encode("ascii"), hashlib.sha256).hexdigest()


def make_state(user_id: str, base_url: str) -> str:
    body = json.dumps(
        {"u": user_id, "b": base_url, "n": secrets.token_urlsafe(12), "e": int(time.time()) + STATE_TTL_SECONDS},
        separators=(",", ":"),
    )
    payload = base64.urlsafe_b64encode(body.encode("utf-8")).decode("ascii").rstrip("=")
    return f"{payload}.{_state_signature(payload)}"


def read_state(state: str) -> tuple[str, str]:
    """(user_id, base_url) from a state this server signed in the last ten minutes."""
    try:
        payload, signature = (state or "").rsplit(".", 1)
    except ValueError:
        raise CanvasAuthError("The Canvas sign-in link is not valid. Start again.")
    if not hmac.compare_digest(signature, _state_signature(payload)):
        raise CanvasAuthError("The Canvas sign-in link is not valid. Start again.")
    try:
        body = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        user_id, base_url, expires = body["u"], body["b"], int(body["e"])
    except (ValueError, KeyError, TypeError):
        raise CanvasAuthError("The Canvas sign-in link is not valid. Start again.")
    if expires < time.time():
        raise CanvasAuthError("The Canvas sign-in took too long. Start again.")
    return user_id, base_url


# --- OAuth --------------------------------------------------------------------


def oauth_client(base_url: str) -> dict[str, str]:
    client = settings.canvas_oauth_client_map.get(base_url)
    if not client:
        raise CanvasAuthError(
            "Your school hasn't set up Canvas access for this app yet. Ask your Canvas "
            "admin to create a developer key for it (see the setup guide)."
        )
    return client


def redirect_uri() -> str:
    return settings.public_api_url.rstrip("/") + "/api/canvas/oauth/callback"


def authorize_url(user_id: str, base_url: str) -> str:
    client = oauth_client(base_url)
    query = urlencode({
        "client_id": client["client_id"],
        "response_type": "code",
        "redirect_uri": redirect_uri(),
        "state": make_state(user_id, base_url),
        "scope": " ".join(SCOPES),
    })
    return f"{base_url}/login/oauth2/auth?{query}"


@dataclass
class TokenGrant:
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    canvas_user_id: Optional[int]


def _token_request(base_url: str, form: dict, http: Optional[httpx.Client] = None) -> TokenGrant:
    """POST to Canvas's token endpoint. Errors never echo the response body, which may hold tokens."""
    owned = http is None
    http = http or http_factory()
    try:
        response = http.post(f"{base_url}/login/oauth2/token", data=form)
    except (httpx.HTTPError, net_guard.UnsafeAddress):
        raise CanvasAuthError("Couldn't reach Canvas to finish signing in. Try again.") from None
    finally:
        if owned:
            http.close()

    if response.status_code != 200:
        raise CanvasAuthError(f"Canvas refused the sign-in (HTTP {response.status_code}). Try again.")
    try:
        body = response.json()
        access = body["access_token"]
    except (ValueError, KeyError):
        raise CanvasAuthError("Canvas sent back a sign-in response this app can't read.") from None

    expires_in = body.get("expires_in")
    return TokenGrant(
        access_token=access,
        refresh_token=body.get("refresh_token"),
        expires_at=(datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))) if expires_in else None,
        canvas_user_id=(body.get("user") or {}).get("id"),
    )


def exchange_code(base_url: str, code: str, http: Optional[httpx.Client] = None) -> TokenGrant:
    client = oauth_client(base_url)
    return _token_request(base_url, {
        "grant_type": "authorization_code",
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "redirect_uri": redirect_uri(),
        "code": code,
    }, http)


def refresh(base_url: str, refresh_token: str, http: Optional[httpx.Client] = None) -> TokenGrant:
    """Canvas keeps the same refresh token, so the grant usually comes back without one."""
    client = oauth_client(base_url)
    grant = _token_request(base_url, {
        "grant_type": "refresh_token",
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "refresh_token": refresh_token,
    }, http)
    grant.refresh_token = grant.refresh_token or refresh_token
    return grant


def revoke(base_url: str, access_token: str, http: Optional[httpx.Client] = None) -> None:
    """Best effort: ask Canvas to forget the token. Disconnecting goes ahead either way."""
    owned = http is None
    http = http or http_factory()
    try:
        http.delete(f"{base_url}/login/oauth2/token", headers={"Authorization": f"Bearer {access_token}"})
    except (httpx.HTTPError, net_guard.UnsafeAddress):
        pass
    finally:
        if owned:
            http.close()


def access_token_for(connection, db, http: Optional[httpx.Client] = None) -> str:
    """The connection's access token, refreshed first if it is about to expire."""
    token = decrypt_token(connection.access_token_enc)
    expires = connection.expires_at
    if connection.auth_type != "oauth" or expires is None:
        return token
    if expires - REFRESH_MARGIN > datetime.now(timezone.utc):
        return token
    if not connection.refresh_token_enc:
        raise CanvasAuthError("Your Canvas sign-in expired. Connect Canvas again.")

    grant = refresh(connection.base_url, decrypt_token(connection.refresh_token_enc), http)
    connection.access_token_enc = encrypt_token(grant.access_token)
    connection.refresh_token_enc = encrypt_token(grant.refresh_token) if grant.refresh_token else None
    connection.expires_at = grant.expires_at
    db.commit()
    return grant.access_token
