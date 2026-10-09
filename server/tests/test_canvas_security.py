"""
The parts of the Canvas integration that protect users and the server: the
address checks (SSRF), redirects, token handling, throttling and the OAuth
state. Only the endpoint tests at the bottom need Postgres.

Run from server/ with: python -m tests.test_canvas_security
"""
import io
import sys

import httpx

from api.config import Settings
from api.models.database import CanvasConnection
from api.services import canvas_auth, net_guard
from api.services.canvas_client import CanvasClient, CanvasError, CanvasForbidden
from tests import fake_canvas, support
from tests.fake_canvas import BASE, TOKEN, FakeCanvas

fake_canvas.use_fake_dns()


def raises(exception, call, *args, **kwargs):
    try:
        call(*args, **kwargs)
    except exception as e:
        return e
    raise AssertionError(f"{getattr(call, '__name__', call)}{args} did not raise {exception.__name__}")


# --- addresses ----------------------------------------------------------------


def test_base_url_is_normalised():
    for raw in ("canvas.test.edu", "https://Canvas.Test.edu/", " https://canvas.test.edu ", "https://canvas.test.edu:443"):
        assert net_guard.normalize_https_origin(raw) == BASE, raw


def test_base_url_must_be_a_plain_https_origin():
    for raw in (
        "http://canvas.test.edu",
        "ftp://canvas.test.edu",
        "https://user:pw@canvas.test.edu",
        "https://canvas.test.edu/courses/1",
        "https://canvas.test.edu/?x=1",
        "https://canvas.test.edu:8443",
        "https://93.184.216.34",
        "https://[::1]",
        "https://localhost",
        "",
    ):
        raises(net_guard.UnsafeAddress, net_guard.normalize_https_origin, raw)


def test_hosts_resolving_to_private_addresses_are_refused():
    assert net_guard.check_https_origin("canvas.test.edu") == BASE
    for host in ("intranet.test", "metadata.test", "loopback.test", "cgnat.test", "v6-loopback.test", "mixed.test"):
        error = raises(net_guard.UnsafeAddress, net_guard.check_https_origin, f"https://{host}")
        assert "private or local" in str(error), host
    raises(net_guard.UnsafeAddress, net_guard.check_https_origin, "https://no-such-host.test")


def test_is_public():
    assert net_guard.is_public("93.184.216.34")
    for address in ("10.1.2.3", "172.16.0.1", "192.168.0.1", "127.0.0.1", "169.254.169.254",
                    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:10.0.0.1"):
        assert not net_guard.is_public(address), address


def test_guarded_transport_checks_the_address_it_connects_to():
    """The guard sits in the connection itself, not only in a check before the request."""
    with net_guard.guarded_client(timeout=2) as client:
        error = raises(httpx.ConnectError, client.get, "https://loopback.test/api/v1/users/self")
    assert "private or local" in str(error)


# --- the Canvas client ----------------------------------------------------------


def test_api_redirects_are_not_followed():
    fake = FakeCanvas()
    fake.overrides["/api/v1/courses"] = lambda r: httpx.Response(302, headers={"Location": "https://intranet.test/"})
    raises(CanvasForbidden, fake.client(BASE, TOKEN).get_json, "/api/v1/courses")
    assert all(r.url.host == "canvas.test.edu" for r in fake.requests)


def test_pagination_stays_on_the_schools_host():
    fake = FakeCanvas()
    fake.overrides["/api/v1/courses"] = lambda r: httpx.Response(
        200, json=[{"id": 1, "name": "A"}],
        headers={"Link": '<https://intranet.test/api/v1/courses?page=2>; rel="next"'},
    )
    assert [c["id"] for c in fake.client(BASE, TOKEN).paginate("/api/v1/courses")] == [1]
    assert len(fake.requests) == 1


def test_pagination_follows_link_headers():
    fake = FakeCanvas()
    pages = list(fake.client(BASE, TOKEN).paginate("/api/v1/courses/101/pages", {"per_page": 100}))
    assert [p["page_id"] for p in pages] == [3001, 3002, 3003]
    assert len(fake.requests) == 2


def test_download_sends_the_token_to_canvas_only():
    fake = FakeCanvas()
    data = fake.client(BASE, TOKEN).download(f"{BASE}/files/9001/download?verifier=v9001", 10_000_000)
    assert data.startswith(b"%PDF")
    canvas_hop, store_hop = fake.requests
    assert canvas_hop.headers["Authorization"] == f"Bearer {TOKEN}"
    assert store_hop.url.host == fake_canvas.FILE_HOST
    assert "Authorization" not in store_hop.headers


def test_download_refuses_unsafe_redirects():
    for target in ("https://metadata.test/latest/meta-data", "http://files.canvas-cdn.test/blobs/9001",
                   "https://files.canvas-cdn.test:8080/blobs/9001", "https://10.0.0.1/blobs/9001"):
        fake = FakeCanvas()
        fake.overrides["/files/9001/download"] = lambda r, t=target: httpx.Response(302, headers={"Location": t})
        raises(CanvasError, fake.client(BASE, TOKEN).download, f"{BASE}/files/9001/download", 10_000_000)
        assert all(r.url.host == "canvas.test.edu" for r in fake.requests), target


def test_download_size_and_redirect_limits():
    fake = FakeCanvas()
    error = raises(CanvasError, fake.client(BASE, TOKEN).download, f"{BASE}/files/9001/download", 100)
    assert "larger than the import limit" in str(error)

    looping = FakeCanvas()
    looping.overrides["/files/9001/download"] = lambda r: httpx.Response(
        302, headers={"Location": f"{BASE}/files/9001/download"}
    )
    raises(CanvasError, looping.client(BASE, TOKEN).download, f"{BASE}/files/9001/download", 10_000_000)
    assert len(looping.requests) == 4


def test_throttling_backs_off_and_retries():
    fake = FakeCanvas()
    fake.throttle_next = 2
    me = fake.client(BASE, TOKEN).get_json("/api/v1/users/self")
    assert me["id"] == 4471
    assert fake.sleeps == [1.0, 2.0], "exponential backoff between attempts"

    retry_after = FakeCanvas()
    calls = []

    def once_then_ok(request):
        calls.append(1)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "7"})
        return httpx.Response(200, json={"id": 1})

    retry_after.overrides["/api/v1/users/self"] = once_then_ok
    retry_after.client(BASE, TOKEN).get_json("/api/v1/users/self")
    assert retry_after.sleeps == [7.0]

    stuck = FakeCanvas()
    stuck.throttle_next = 100
    raises(CanvasError, stuck.client(BASE, TOKEN).get_json, "/api/v1/users/self")


def test_low_budget_slows_down():
    fake = FakeCanvas()
    fake.overrides["/api/v1/users/self"] = lambda r: httpx.Response(
        200, json={"id": 1}, headers={"X-Rate-Limit-Remaining": "12.5"}
    )
    fake.client(BASE, TOKEN).get_json("/api/v1/users/self")
    assert fake.sleeps == [1.0]


def test_errors_never_carry_the_token():
    fake = FakeCanvas()
    fake.valid_tokens = set()
    error = raises(CanvasError, CanvasClient(BASE, TOKEN, http=fake.http()).get_json, "/api/v1/users/self")
    assert TOKEN not in str(error) and TOKEN not in repr(error)


# --- tokens and state -------------------------------------------------------------


def test_tokens_are_encrypted_and_keys_can_rotate():
    from cryptography.fernet import Fernet

    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    saved = support.settings.canvas_token_key
    try:
        support.settings.canvas_token_key = old
        blob = canvas_auth.encrypt_token(TOKEN)
        assert TOKEN not in blob and canvas_auth.decrypt_token(blob) == TOKEN

        support.settings.canvas_token_key = f"{new},{old}"
        assert canvas_auth.decrypt_token(blob) == TOKEN, "old tokens still read after rotation"

        support.settings.canvas_token_key = new
        raises(canvas_auth.CanvasAuthError, canvas_auth.decrypt_token, blob)
    finally:
        support.settings.canvas_token_key = saved


def test_oauth_state_is_signed_and_expires():
    state = canvas_auth.make_state("alice", BASE)
    assert canvas_auth.read_state(state) == ("alice", BASE)

    payload, signature = state.rsplit(".", 1)
    raises(canvas_auth.CanvasAuthError, canvas_auth.read_state, f"{payload}.{'0' * len(signature)}")
    raises(canvas_auth.CanvasAuthError, canvas_auth.read_state, "garbage")

    saved = canvas_auth.STATE_TTL_SECONDS
    canvas_auth.STATE_TTL_SECONDS = -1
    try:
        expired = canvas_auth.make_state("alice", BASE)
    finally:
        canvas_auth.STATE_TTL_SECONDS = saved
    raises(canvas_auth.CanvasAuthError, canvas_auth.read_state, expired)


def test_personal_tokens_cannot_be_enabled_with_real_sign_in():
    error = raises(Exception, Settings, auth_mode="clerk", secret_key="x" * 40,
                   canvas_allow_personal_tokens=True, canvas_token_key="k")
    assert "local testing only" in str(error)
    error = raises(Exception, Settings, auth_mode="clerk", secret_key="x" * 40,
                   canvas_oauth_clients='{"https://canvas.test.edu": {"client_id": "1", "client_secret": "s"}}')
    assert "CANVAS_TOKEN_KEY" in str(error)


def test_authorize_url_asks_for_read_only_scopes():
    saved = support.settings.canvas_oauth_clients
    support.settings.canvas_oauth_clients = '{"https://canvas.test.edu": {"client_id": "170000000000042", "client_secret": "s3cret"}}'
    try:
        url = httpx.URL(canvas_auth.authorize_url("alice", BASE))
    finally:
        support.settings.canvas_oauth_clients = saved
    assert url.host == "canvas.test.edu" and url.path == "/login/oauth2/auth"
    params = dict(url.params)
    assert params["client_id"] == "170000000000042" and "s3cret" not in str(url)
    scopes = params["scope"].split(" ")
    assert scopes and all(scope.startswith("url:GET|") for scope in scopes)
    assert not any(word in params["scope"] for word in ("quiz", "submission", "grade", "enrollment"))
    assert canvas_auth.read_state(params["state"]) == ("alice", BASE)


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
        assert back.status_code == 302 and back.headers["location"].endswith("/app?canvas=connected")

        denied = api.get("/api/canvas/oauth/callback", params={"state": state, "error": "access_denied"}, follow_redirects=False)
        assert "canvas=denied" in denied.headers["location"]
        tampered = api.get("/api/canvas/oauth/callback", params={"state": state + "x", "code": "c"}, follow_redirects=False)
        assert "canvas=error" in tampered.headers["location"]

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
