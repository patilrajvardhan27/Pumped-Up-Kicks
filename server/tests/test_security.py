"""
Sign-in checks, response headers, error text, and upload and list limits.
The sign-in, header and error tests need no database; the upload and list
tests do (see tests/support.py).

Run from server/ with: python -m tests.test_security
"""
import importlib.util
import logging
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

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


# --- headers, docs, errors ----------------------------------------------------


def load_app_as_production():
    """A second copy of api.main, built while the settings say production."""
    spec = importlib.util.spec_from_file_location("api_main_production", support.SERVER_DIR / "api" / "main.py")
    module = importlib.util.module_from_spec(spec)
    with changed(support.settings, env="production", allowed_hosts="testserver"):
        spec.loader.exec_module(module)
        return module


def test_docs_are_off_outside_development():
    production_app = load_app_as_production().app
    with changed(support.settings, env="production"):
        api = TestClient(production_app)
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert api.get(path).status_code == 404, path
    assert TestClient(app).get("/openapi.json").status_code == 200


def test_security_headers_are_on_every_response():
    expected = {
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    }
    response = TestClient(app).get("/")
    for name, value in expected.items():
        assert response.headers[name] == value
    assert "strict-transport-security" not in response.headers  # development

    production_app = load_app_as_production().app
    with changed(support.settings, env="production"):
        hsts = TestClient(production_app).get("/").headers["strict-transport-security"]
    assert hsts == "max-age=63072000; includeSubDomains"


def test_unknown_host_is_refused_in_production():
    production_app = load_app_as_production().app
    response = TestClient(production_app, base_url="http://evil.example").get("/health")
    assert response.status_code == 400


def test_root_and_health_say_little():
    api = TestClient(app)
    assert api.get("/").json() == {"name": "Pumped Up Kicks API"}
    assert api.get("/health").json()["status"] in ("ok", "degraded")
    assert set(api.get("/health").json()) == {"status"}


def test_cors_does_not_allow_credentials():
    response = TestClient(app).options("/api/videos", headers={
        "Origin": ORIGIN, "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_unhandled_error_gives_a_generic_500():
    async def boom():
        raise RuntimeError("secret detail at /etc/passwd")

    app.add_api_route("/__boom", boom)
    try:
        response = TestClient(app, raise_server_exceptions=False).get("/__boom")
    finally:
        app.router.routes.pop()
    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Something went wrong. Try again."
    assert body["request_id"] and body["request_id"] == response.headers["x-request-id"]
    assert "secret" not in response.text and "passwd" not in response.text
    assert response.headers["x-content-type-options"] == "nosniff"


def test_access_log_hides_media_tokens():
    from api.main import _HideSecrets

    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4:5", "GET", "/api/videos/file/users/a/b.mp4?token=alice.123.SIGNATURE", "1.1", 200), None,
    )
    _HideSecrets().filter(record)
    assert "SIGNATURE" not in record.getMessage()
    assert "/api/videos/file/users/a/b.mp4" in record.getMessage()


# --- limits (Postgres) --------------------------------------------------------


def test_list_limits_are_capped_at_100():
    support.fresh()
    api = support.client("alice")
    for path in ("/api/videos", "/api/chat/conversations"):
        assert api.get(path, params={"limit": 100}).status_code == 200
        too_many = api.get(path, params={"limit": 101})
        assert too_many.status_code == 422, path
        assert api.get(path, params={"limit": 0}).status_code == 422
    junk = api.get("/api/videos", params={"limit": "hunter2"})
    assert junk.status_code == 422 and "hunter2" not in junk.text


def test_chat_health_route_is_gone():
    support.fresh()
    assert support.client("alice").get("/api/chat/health").status_code in (404, 405)


def test_upload_over_the_limit_is_refused_and_cleaned_up():
    support.fresh()
    api = support.client("alice")
    with tempfile.TemporaryDirectory() as root, changed(support.settings, max_upload_bytes=1000):
        support.use_storage(Path(root))
        # Inside the framing allowance: stopped while the file is written.
        small = api.post("/api/videos/upload", files={"file": ("big.mp4", b"x" * 5000, "video/mp4")})
        assert small.status_code == 413
        # Far past it: stopped from the declared length, before the body is read.
        huge = api.post("/api/videos/upload", files={"file": ("huge.mp4", b"x" * 300_000, "video/mp4")})
        assert huge.status_code == 413
        assert [p for p in Path(root).rglob("*") if p.is_file()] == []
        assert api.get("/api/videos").json()["total"] == 0


def test_upload_within_the_limit_is_stored_under_a_unique_key():
    support.fresh()
    api = support.client("alice")
    other = support.client("bob")
    with tempfile.TemporaryDirectory() as root:
        support.use_storage(Path(root))
        for who in (api, other):
            sent = who.post("/api/videos/upload", files={"file": ("lecture.mp4", b"abc" * 100, "video/mp4")})
            assert sent.status_code == 200, sent.text
        files = sorted(p.name for p in Path(root).rglob("*") if p.is_file())
        assert len(files) == 2 and all(name.endswith("-lecture.mp4") for name in files)


def test_presign_has_no_storage_key():
    support.fresh()
    api = support.client("alice")
    with tempfile.TemporaryDirectory() as root:
        support.use_storage(Path(root))
        response = api.post("/api/videos/presign", json={"filename": "a.mp4", "file_size": 10})
        assert response.status_code == 200
        assert set(response.json()) == {"video_id", "upload_url", "method"}


if __name__ == "__main__":
    support.run(globals())
