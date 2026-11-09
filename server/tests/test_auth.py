"""Session token checks, with a locally generated key standing in for Clerk."""
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from api.config import settings
from api.services import auth

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
APP = "https://kicks.example"


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    signing = SimpleNamespace(key=KEY.public_key())
    monkeypatch.setattr(auth, "_get_jwk_client", lambda: SimpleNamespace(get_signing_key_from_jwt=lambda _: signing))
    monkeypatch.setattr(settings, "clerk_issuer", None)
    monkeypatch.setattr(settings, "clerk_authorized_parties", APP)


def token(**claims) -> str:
    now = int(time.time())
    body = {"sub": "user_1", "iat": now, "exp": now + 60, "azp": APP, **claims}
    return jwt.encode({k: v for k, v in body.items() if v is not None}, KEY, algorithm="RS256")


def test_valid_token_passes():
    assert auth.verify_clerk_token(token())["sub"] == "user_1"


def test_token_for_another_site_is_rejected():
    with pytest.raises(auth.AuthError, match="not valid"):
        auth.verify_clerk_token(token(azp="https://evil.example"))


def test_expired_token_is_rejected():
    with pytest.raises(auth.AuthError, match="expired"):
        auth.verify_clerk_token(token(exp=int(time.time()) - 60))


@pytest.mark.parametrize("missing", ["sub", "exp", "iat"])
def test_required_claims(missing):
    with pytest.raises(auth.AuthError):
        auth.verify_clerk_token(token(**{missing: None}))


def test_rejection_reason_is_not_returned():
    with pytest.raises(auth.AuthError) as caught:
        auth.verify_clerk_token("not.a.jwt")
    assert str(caught.value) == auth.INVALID
