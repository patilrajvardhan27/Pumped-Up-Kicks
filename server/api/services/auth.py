"""
Identity. Verifies a Clerk session JWT and maps it onto a local User row.

In `dev` auth mode no token is required and every request resolves to a single
built-in user, so the app runs on a laptop with no Clerk account. Switching
AUTH_MODE to `clerk` turns on real verification with no other code change.
"""
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from jwt import PyJWKClient

from api.config import settings


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
    """Verify a Clerk session token's signature, expiry, and issuer."""
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": bool(settings.clerk_issuer),
                # Clerk session tokens carry no `aud` by default.
                "verify_aud": False,
            },
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Your session expired. Sign in again.")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"Invalid session token: {e}")

    if not claims.get("sub"):
        raise AuthError("Session token has no subject claim.")

    return claims


def claims_to_profile(claims: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Pull a user profile out of the token.

    Email is only present if you add it to the Clerk JWT template; when it is
    missing we fall back to a placeholder rather than failing the request, and
    fetch_clerk_profile() can fill it in later.
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


async def fetch_clerk_profile(user_id: str, secret_key: str) -> Dict[str, Any]:
    """Optional backfill via Clerk's Backend API, when the JWT lacks an email."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
        )
        response.raise_for_status()
        return response.json()


def dev_profile() -> Dict[str, Optional[str]]:
    return {
        "id": settings.dev_user_id,
        "email": settings.dev_user_email,
        "display_name": "Local Developer",
    }
