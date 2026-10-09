"""
A small, read-only client for the Canvas REST API.

- Pagination follows the Link header's rel="next", and only while the next
  page is on the school's own host.
- Throttling: when a token's request budget runs out Canvas answers 403 with
  "Rate Limit Exceeded" (some deployments use 429). The client backs off and
  retries, and slows down by itself when X-Rate-Limit-Remaining runs low.
- API calls never follow redirects. A redirect from an API endpoint usually
  means the token is no good and Canvas is sending the browser to its login.
- File bytes are served from Canvas's file store on a different host, so a
  download follows up to three redirects. Each hop is checked by net_guard,
  and the token is only ever sent to the school's own host.

Errors carry messages that are safe to show to the student. None of them
contains the token or a response body.
"""
import time
from typing import Callable, Iterator, Optional
from urllib.parse import urljoin, urlsplit

import httpx

from api.services import net_guard

MAX_RETRIES = 5
MAX_BACKOFF_SECONDS = 60.0
LOW_BUDGET = 100.0
MAX_DOWNLOAD_HOPS = 3
REDIRECTS = {301, 302, 303, 307, 308}


class CanvasError(Exception):
    """A Canvas request failed. The message is safe to show."""

    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


class CanvasForbidden(CanvasError):
    """The student may not see this (a hidden tab, a locked file) or the token was refused."""


class CanvasNotFound(CanvasError):
    pass


def _throttled(response: httpx.Response) -> bool:
    if response.status_code == 429:
        return True
    return response.status_code == 403 and "rate limit exceeded" in response.text.lower()


class CanvasClient:
    def __init__(
        self,
        base_url: str,
        token: str,
        http: Optional[httpx.Client] = None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.base_url = base_url.rstrip("/")
        self.host = urlsplit(self.base_url).hostname
        self._token = token
        self._http = http or net_guard.guarded_client(timeout=httpx.Timeout(30.0, connect=10.0))
        self._sleep = sleep

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "CanvasClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # -- plumbing ---------------------------------------------------------

    def _on_our_host(self, url: str) -> bool:
        parts = urlsplit(url)
        return parts.scheme == "https" and parts.hostname == self.host and parts.port in (None, 443)

    def _url(self, path_or_url: str) -> str:
        url = path_or_url if path_or_url.startswith("https://") else self.base_url + path_or_url
        if not self._on_our_host(url):
            raise CanvasError("Canvas pointed at another site; that page was skipped.")
        return url

    def _pace(self, response: httpx.Response) -> None:
        try:
            remaining = float(response.headers.get("X-Rate-Limit-Remaining", "inf"))
        except ValueError:
            return
        if remaining < LOW_BUDGET:
            self._sleep(1.0)

    def _backoff(self, response: httpx.Response, attempt: int) -> float:
        try:
            wait = float(response.headers.get("Retry-After", ""))
        except ValueError:
            wait = 2.0 ** attempt
        return min(MAX_BACKOFF_SECONDS, max(1.0, wait))

    def get(self, path_or_url: str, params=None) -> httpx.Response:
        url = self._url(path_or_url)
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = self._http.get(
                    url, params=params, headers={"Authorization": f"Bearer {self._token}"}
                )
            except httpx.ConnectError as e:
                raise CanvasError(f"Couldn't connect to Canvas: {e}") from None
            except httpx.HTTPError:
                raise CanvasError("Couldn't reach Canvas. Check your connection and try again.") from None

            if _throttled(response):
                if attempt == MAX_RETRIES:
                    break
                self._sleep(self._backoff(response, attempt))
                continue

            self._pace(response)
            status = response.status_code
            if status in REDIRECTS:
                raise CanvasForbidden("Canvas didn't accept the sign-in. Connect Canvas again.", status)
            if status in (401, 403):
                raise CanvasForbidden("Canvas says you don't have access to this.", status)
            if status == 404:
                raise CanvasNotFound("Canvas couldn't find this.", status)
            if status >= 400:
                raise CanvasError(f"Canvas answered with an error (HTTP {status}).", status)
            return response

        raise CanvasError("Canvas kept asking to slow down. Try syncing again in a few minutes.", 403)

    def get_json(self, path_or_url: str, params=None):
        try:
            return self.get(path_or_url, params).json()
        except ValueError:
            raise CanvasError("Canvas sent back something this app can't read.") from None

    def paginate(self, path: str, params=None) -> Iterator[dict]:
        """Every item across every page of a list endpoint."""
        url: Optional[str] = path
        first = True
        while url:
            response = self.get(url, params if first else None)
            first = False
            try:
                items = response.json()
            except ValueError:
                raise CanvasError("Canvas sent back something this app can't read.") from None
            if not isinstance(items, list):
                raise CanvasError("Canvas sent back something this app can't read.")
            yield from items

            following = response.links.get("next", {}).get("url")
            # A next link to another host is ignored rather than followed.
            url = following if following and self._on_our_host(following) else None

    # -- files --------------------------------------------------------------

    def download(self, url: str, max_bytes: int) -> bytes:
        current = self._url(url)
        for _ in range(MAX_DOWNLOAD_HOPS + 1):
            ours = self._on_our_host(current)
            headers = {"Authorization": f"Bearer {self._token}"} if ours else {}

            try:
                if not ours:
                    net_guard.check_url(current)
                with self._http.stream("GET", current, headers=headers) as response:
                    status = response.status_code
                    if status in REDIRECTS and response.headers.get("location"):
                        current = urljoin(current, response.headers["location"])
                        continue
                    if status in (401, 403):
                        raise CanvasForbidden("You don't have access to this file.", status)
                    if status == 404:
                        raise CanvasNotFound("This file is no longer in Canvas.", status)
                    if status >= 400:
                        raise CanvasError(f"Canvas couldn't send this file (HTTP {status}).", status)

                    declared = response.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise CanvasError("This file is larger than the import limit.")
                    body = bytearray()
                    for piece in response.iter_bytes():
                        body.extend(piece)
                        if len(body) > max_bytes:
                            raise CanvasError("This file is larger than the import limit.")
                    return bytes(body)
            except net_guard.UnsafeAddress as e:
                raise CanvasError(str(e)) from None
            except httpx.HTTPError:
                raise CanvasError("Couldn't download this file from Canvas.") from None

        raise CanvasError("Canvas redirected this download too many times.")
