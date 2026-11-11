"""
The Canvas sign-in endpoints: tokens are stored encrypted and never returned,
state is single-use and per-user, and expired tokens are refreshed.
Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_canvas_oauth
"""
import io
import sys

import httpx

from api.models.database import CanvasConnection
from api.services import canvas_auth
from tests import fake_canvas, support
from tests.fake_canvas import BASE, TOKEN

# --- endpoints (Postgres) ---------------------------------------------------------


OAUTH_CLIENTS = '{"https://canvas.test.edu": {"client_id": "170000000000042", "client_secret": "s3cret"}}'


def test_oauth_flow_stores_encrypted_tokens_and_never_returns_them():
    support.fresh()
    fake_canvas.install()
    api = support.client("alice")
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = OAUTH_CLIENTS
    printed = io.StringIO()
    real_stdout, sys.stdout = sys.stdout, printed
    try:
        assert api.post("/api/canvas/oauth/start", json={"base_url": "other.test.edu"}).status_code == 400
        start = api.post("/api/canvas/oauth/start", json={"base_url": "canvas.test.edu"})
        assert start.status_code == 200, start.text
        state = dict(httpx.URL(start.json()["authorize_url"]).params)["state"]

        back = api.get("/api/canvas/oauth/callback", params={"state": state, "code": "good-code"}, follow_redirects=False)
        location = httpx.URL(back.headers["location"])
        assert back.status_code == 302 and location.path == "/app"
        assert location.params["canvas_code"] == "good-code" and location.params["canvas_state"] == state
        assert api.get("/api/canvas/connection").json()["connected"] is False  # the callback saves nothing

        denied = api.get("/api/canvas/oauth/callback", params={"state": state, "error": "access_denied"}, follow_redirects=False)
        assert "canvas_error=denied" in denied.headers["location"]
        tampered = api.get("/api/canvas/oauth/callback", params={"state": state + "x", "code": "c"}, follow_redirects=False)
        assert "canvas_error=invalid" in tampered.headers["location"]

        done = api.post("/api/canvas/oauth/complete", json={"code": "good-code", "state": state})
        assert done.status_code == 200 and done.json()["connected"] is True, done.text

        status = api.get("/api/canvas/connection")
    finally:
        sys.stdout = real_stdout
        support.settings.canvas_oauth_clients = saved

    body = status.text
    assert status.json()["connected"] is True and status.json()["auth_type"] == "oauth"
    for secret in ("oauth-access-token", "oauth-refresh-token", "s3cret"):
        assert secret not in body, f"{secret} leaked into the API response"
        assert secret not in printed.getvalue(), f"{secret} leaked into the log"

    db = support.session()
    try:
        stored = db.query(CanvasConnection).one()
        assert "oauth-access-token" not in stored.access_token_enc
        assert canvas_auth.decrypt_token(stored.access_token_enc) == "1~oauth-access-token-from-canvas"
        assert stored.expires_at is not None
        assert stored.access_token_enc not in repr(stored)
    finally:
        db.close()


def _start_sign_in(api) -> str:
    start = api.post("/api/canvas/oauth/start", json={"base_url": "canvas.test.edu"})
    assert start.status_code == 200, start.text
    return dict(httpx.URL(start.json()["authorize_url"]).params)["state"]


def test_callback_stores_nothing():
    support.fresh()
    fake_canvas.install()
    api = support.client("alice")
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = OAUTH_CLIENTS
    try:
        state = _start_sign_in(api)
        back = api.get("/api/canvas/oauth/callback", params={"state": state, "code": "good-code"}, follow_redirects=False)
        assert back.status_code == 302
    finally:
        support.settings.canvas_oauth_clients = saved
    db = support.session()
    try:
        assert db.query(CanvasConnection).count() == 0
    finally:
        db.close()


def test_complete_refuses_another_users_state():
    support.fresh()
    fake_canvas.install()
    alice, bob = support.client("alice"), support.client("bob")
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = OAUTH_CLIENTS
    try:
        state = _start_sign_in(alice)
        stolen = bob.post("/api/canvas/oauth/complete", json={"code": "good-code", "state": state})
        assert stolen.status_code == 403
        assert "alice" not in stolen.text
        assert bob.get("/api/canvas/connection").json()["connected"] is False
        # The refused attempt did not use up alice's sign-in.
        assert alice.post("/api/canvas/oauth/complete", json={"code": "good-code", "state": state}).status_code == 200
    finally:
        support.settings.canvas_oauth_clients = saved


def test_complete_state_works_once():
    support.fresh()
    fake_canvas.install()
    api = support.client("alice")
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = OAUTH_CLIENTS
    try:
        state = _start_sign_in(api)
        assert api.post("/api/canvas/oauth/complete", json={"code": "good-code", "state": state}).status_code == 200
        again = api.post("/api/canvas/oauth/complete", json={"code": "good-code", "state": state})
        assert again.status_code == 400
        # A state this server never issued has no nonce on record.
        forged = canvas_auth.make_state("alice", BASE)
        assert api.post("/api/canvas/oauth/complete", json={"code": "c", "state": forged}).status_code == 400
    finally:
        support.settings.canvas_oauth_clients = saved


def test_expired_oauth_token_is_refreshed():
    support.fresh()
    fake = fake_canvas.install()
    from datetime import datetime, timedelta, timezone

    support.client("alice").get("/api/workspaces")  # creates the user row
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = OAUTH_CLIENTS
    db = support.session()
    try:
        db.add(CanvasConnection(
            user_id="alice", base_url=BASE, auth_type="oauth",
            access_token_enc=canvas_auth.encrypt_token("1~expired"),
            refresh_token_enc=canvas_auth.encrypt_token("1~oauth-refresh-token-from-canvas"),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        ))
        db.commit()
        connection = db.query(CanvasConnection).one()
        assert canvas_auth.access_token_for(connection, db) == "1~refreshed-access-token"
        db.refresh(connection)
        assert canvas_auth.decrypt_token(connection.refresh_token_enc) == "1~oauth-refresh-token-from-canvas"
        assert connection.expires_at > datetime.now(timezone.utc)
    finally:
        db.close()
        support.settings.canvas_oauth_clients = saved
    assert "/login/oauth2/token" in fake.paths()


def test_personal_token_path_is_off_unless_enabled():
    support.fresh()
    fake_canvas.install()
    api = support.client("alice")
    request = {"base_url": "canvas.test.edu", "token": TOKEN}
    assert api.post("/api/canvas/token", json=request).status_code == 403

    support.settings.canvas_allow_personal_tokens = True
    try:
        assert api.post("/api/canvas/token", json={**request, "base_url": "https://intranet.test"}).status_code == 400
        assert api.post("/api/canvas/token", json={**request, "token": "not-a-real-token"}).status_code == 400
        connected = api.post("/api/canvas/token", json=request)
        assert connected.status_code == 200, connected.text
        assert TOKEN not in connected.text
    finally:
        support.settings.canvas_allow_personal_tokens = False


def test_disconnect_deletes_tokens():
    support.fresh()
    fake_canvas.install()
    api = support.client("alice")
    support.settings.canvas_allow_personal_tokens = True
    try:
        api.post("/api/canvas/token", json={"base_url": "canvas.test.edu", "token": TOKEN})
    finally:
        support.settings.canvas_allow_personal_tokens = False
    assert api.delete("/api/canvas/connection").status_code == 200
    db = support.session()
    try:
        assert db.query(CanvasConnection).count() == 0
    finally:
        db.close()
    assert api.get("/api/canvas/connection").json()["connected"] is False


if __name__ == "__main__":
    support.run(globals())
