"""
Identity. Verifies a Clerk session JWT and maps it onto a local User row.

In `dev` auth mode no token is required and every request resolves to a single
built-in user, so the app runs on a laptop with no Clerk account. Switching
AUTH_MODE to `clerk` turns on real verification with no other code change.
"""
import logging
import time
from typing import Any, Dict, Optional

import jwt
from jwt import PyJWKClient

from api.config import settings


log = logging.getLogger("kicks")

INVALID = "Your session is not valid. Sign in again."


class AuthError(Exception):
    """Raised when a request carries no usable identity."""


_jwk_client: Optional[PyJWKClient] = None
_jwk_client_created_at: float = 0.0
_JWK_CLIENT_TTL = 3600  # refetch the key set hourly so rotations are picked up


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client, _jwk_client_created_at

    if not settings.clerk_jwks_url:
        raise AuthError(
            "AUTH_MODE=clerk but CLERK_JWKS_URL is not set. "
            "It looks like https://<your-app>.clerk.accounts.dev/.well-known/jwks.json"
        )

    expired = time.time() - _jwk_client_created_at > _JWK_CLIENT_TTL
    if _jwk_client is None or expired:
        _jwk_client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
        _jwk_client_created_at = time.time()

    return _jwk_client


def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verify a Clerk session token's signature, expiry, issuer and origin.

    Clerk session tokens live for about a minute and are refreshed by the
    browser while the tab is in use, so an idle or signed-out session stops
    working here within that minute. Messages stay generic; the reason a token
    was rejected is logged, not returned.
    """
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            leeway=5,  # tolerate small clock drift between Clerk and this server
            options={
                "require": ["exp", "iat", "sub"],
                "verify_iss": bool(settings.clerk_issuer),
                # Clerk session tokens carry no `aud` by default; `azp` is checked below.
                "verify_aud": False,
            },
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Your session expired. Sign in again.")
    except jwt.InvalidTokenError as e:
        log.info("[Auth] rejected token: %s", e)
        raise AuthError(INVALID)

    parties = settings.clerk_authorized_party_list
    if parties and claims.get("azp") not in parties:
        # A valid token minted for a different site must not open this API.
        log.info("[Auth] rejected token from azp=%r", claims.get("azp"))
        raise AuthError(INVALID)

    return claims


def claims_to_profile(claims: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Pull a user profile out of the token.

    Email is only present if you add it to the Clerk JWT template; when it is
    missing we fall back to a placeholder rather than failing the request.
    """
    user_id = claims["sub"]
    email = claims.get("email") or claims.get("primary_email_address")
    name = claims.get("name") or claims.get("full_name")

    if not email:
        first = claims.get("first_name") or ""
        last = claims.get("last_name") or ""
        name = name or f"{first} {last}".strip() or None
        email = f"{user_id}@users.noreply.clerk"

    return {"id": user_id, "email": email, "display_name": name}


def dev_profile() -> Dict[str, Optional[str]]:
    return {
        "id": settings.dev_user_id,
        "email": settings.dev_user_email,
        "display_name": "Local Developer",
    }
