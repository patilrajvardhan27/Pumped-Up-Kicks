"""
Sign-in checks, response headers, error text, and upload and list limits.
The sign-in, header and error tests need no database; the upload and list
tests do (see tests/support.py).

Run from server/ with: python -m tests.test_security
"""
import time
from contextlib import contextmanager

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.config import Settings
from api.deps import get_ctx
from api.main import app
from api.services import auth
from tests import support

ISSUER = "https://clerk.test.local"
ORIGIN = "http://localhost:3000"
GOOD_SECRET = "x" * 40
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@contextmanager
def changed(obj, **values):
    saved = {name: getattr(obj, name) for name in values}
    for name, value in values.items():
        setattr(obj, name, value)
    try:
        yield
    finally:
        for name, value in saved.items():
            setattr(obj, name, value)


class _Key:
    key = PRIVATE_KEY.public_key()


class _Jwks:
    def get_signing_key_from_jwt(self, token):
        return _Key()


@contextmanager
def clerk_mode():
    saved_client = auth._get_jwk_client
    auth._get_jwk_client = lambda: _Jwks()
    try:
        with changed(
            support.settings, auth_mode="clerk", clerk_issuer=ISSUER, cors_origins=ORIGIN,
        ):
            yield
    finally:
        auth._get_jwk_client = saved_client


def token(**overrides) -> str:
    now = int(time.time())
    claims = {"sub": "user_1", "iss": ISSUER, "iat": now, "exp": now + 60, "azp": ORIGIN}
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, PRIVATE_KEY, algorithm="RS256")


# --- configuration ------------------------------------------------------------


def production(**overrides) -> Settings:
    values = dict(
        env="production", auth_mode="clerk", secret_key=GOOD_SECRET, allowed_hosts="api.example.com",
        clerk_jwks_url=ISSUER + "/.well-known/jwks.json", clerk_issuer=ISSUER,
    )
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_settings_load():
    assert production().is_development is False


def test_dev_auth_is_refused_outside_development():
    with pytest.raises(ValidationError):
        production(auth_mode="dev")
    assert Settings(_env_file=None, env="development", auth_mode="dev").auth_mode == "dev"


def test_default_mode_is_clerk_and_default_env_is_production():
    fields = Settings.model_fields
    assert fields["auth_mode"].default == "clerk"
    assert fields["env"].default == "production"


def test_production_needs_a_real_secret_and_hosts():
    with pytest.raises(ValidationError):
        production(secret_key="dev-insecure-change-me")
    with pytest.raises(ValidationError):
        production(allowed_hosts="")


# --- session tokens -----------------------------------------------------------


def test_a_good_token_is_accepted():
    with clerk_mode():
        assert auth.verify_clerk_token(token())["sub"] == "user_1"


def test_token_without_expiry_is_rejected():
    with clerk_mode(), pytest.raises(auth.AuthError):
        auth.verify_clerk_token(token(exp=None))


def test_token_without_issued_at_or_issuer_is_rejected():
    with clerk_mode():
        for missing in ("iat", "iss", "sub"):
            with pytest.raises(auth.AuthError):
                auth.verify_clerk_token(token(**{missing: None}))


def test_token_for_another_origin_is_rejected():
    with clerk_mode(), pytest.raises(auth.AuthError):
        auth.verify_clerk_token(token(azp="https://evil.example"))


def test_token_without_azp_is_accepted():
    with clerk_mode():
        assert auth.verify_clerk_token(token(azp=None))["sub"] == "user_1"


def test_auth_failures_show_one_generic_message():
    saved = app.dependency_overrides.pop(get_ctx, None)
    try:
        with clerk_mode():
            api = TestClient(app)
            for bad in (token(exp=None), token(azp="https://evil.example"), "not.a.token"):
                response = api.get("/api/videos", headers={"Authorization": f"Bearer {bad}"})
                assert response.status_code == 401
                assert response.json()["detail"] == "Session expired or invalid"
    finally:
        if saved is not None:
            app.dependency_overrides[get_ctx] = saved


if __name__ == "__main__":
    support.run(globals())
