"""
The parts of the Canvas integration that protect users and the server: the
address checks (SSRF), redirects, token handling, throttling and the OAuth
state. Only the endpoint tests at the bottom need Postgres.

Run from server/ with: python -m tests.test_canvas_security
"""

import httpx

from api.config import Settings
from api.services import canvas_auth, net_guard
from tests import fake_canvas, support
from tests.fake_canvas import BASE, TOKEN

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


def test_access_log_hides_the_oauth_code():
    import logging

    from api.main import _HideSecrets

    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4:5", "GET", "/api/canvas/oauth/callback?code=SECRET-CODE&state=abc", "1.1", 302), None,
    )
    _HideSecrets().filter(record)
    assert "SECRET-CODE" not in record.getMessage()
    assert "/api/canvas/oauth/callback" in record.getMessage()


if __name__ == "__main__":
    support.run(globals())
