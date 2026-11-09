"""
Transport and error-handling guarantees. No database, no network.
Run from server/ with: python -m pytest tests
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import errors, middleware
from api.config import Settings, settings

ORIGIN = settings.cors_origin_list[0]


def make_app() -> FastAPI:
    app = FastAPI()
    errors.install(app)
    middleware.install(app)

    @app.get("/api/boom")
    def boom():
        raise RuntimeError("password=hunter2 at /srv/app/secret.py line 7")

    @app.get("/api/ok")
    def ok():
        return {"ok": True}

    return app


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")


def test_security_headers_on_every_response():
    response = TestClient(make_app()).get("/api/ok")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "strict-transport-security" not in response.headers, "HSTS only in production"


def test_production_adds_hsts_and_csp(production):
    response = TestClient(make_app()).get("/api/ok", headers={"x-forwarded-proto": "https"})
    assert "max-age=31536000" in response.headers["strict-transport-security"]
    assert "default-src 'none'" in response.headers["content-security-policy"]


def test_production_redirects_plain_http(production):
    response = TestClient(make_app()).get(
        "/api/ok", headers={"x-forwarded-proto": "http"}, follow_redirects=False
    )
    assert response.status_code == 308
    assert response.headers["location"].startswith("https://")


def test_unhandled_error_hides_internals_in_production(production):
    client = TestClient(make_app(), raise_server_exceptions=False)
    response = client.get("/api/boom", headers={"Origin": ORIGIN, "x-forwarded-proto": "https"})
    assert response.status_code == 500
    detail = response.json()["detail"]
    assert "hunter2" not in detail and "/srv" not in detail
    assert "ref " in detail, "a reference id lets the student report it"
    assert response.headers.get("access-control-allow-origin") == ORIGIN, "readable by the browser"


def test_cors_rejects_unknown_origins_and_credentials():
    response = TestClient(make_app()).options(
        "/api/ok",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"
    assert "access-control-allow-credentials" not in response.headers


def test_safe_detail_shows_raw_text_only_in_development(production):
    assert "secret" not in errors.safe_detail(ValueError("secret path"), "test")


@pytest.mark.parametrize(
    "overrides, problem",
    [
        ({"auth_mode": "dev"}, "AUTH_MODE"),
        ({"secret_key": "dev-insecure-change-me"}, "SECRET_KEY"),
        ({"cors_origins": "http://kicks.example"}, "https://"),
        ({"clerk_issuer": None}, "CLERK_ISSUER"),
    ],
)
def test_production_refuses_unsafe_settings(overrides, problem):
    safe = dict(
        environment="production", auth_mode="clerk", secret_key="x" * 40,
        clerk_jwks_url="https://a.example/jwks", clerk_issuer="https://a.example",
        cors_origins="https://kicks.example",
    )
    with pytest.raises(ValueError, match=problem):
        Settings(_env_file=None, **{**safe, **overrides})
