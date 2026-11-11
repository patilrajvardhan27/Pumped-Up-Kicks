"""
The Canvas HTTP client: redirects, pagination, downloads, throttling, and that
the token never leaves for another host or appears in an error.

Run from server/ with: python -m tests.test_canvas_client
"""

import httpx

from api.services.canvas_client import CanvasClient, CanvasError, CanvasForbidden
from tests import fake_canvas, support
from tests.fake_canvas import BASE, TOKEN, FakeCanvas
from tests.test_canvas_security import raises

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


if __name__ == "__main__":
    support.run(globals())
