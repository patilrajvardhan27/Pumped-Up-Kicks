"""
Request-level protection: a generic 500 for anything unhandled, an upload size cap
before the body is read, and security headers on every response.
"""
import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders

from api.config import settings
from api.services.errors import GENERIC_MESSAGE, new_request_id, request_id

log = logging.getLogger("api")

UPLOAD_PATH = "/api/videos/upload"
# Multipart framing and form fields on top of the file itself.
UPLOAD_OVERHEAD_BYTES = 64 * 1024


def server_error(request: Request, exc: Exception) -> JSONResponse:
    rid = request_id(request)
    log.error("Unhandled error on %s %s (request %s)", request.method, request.url.path, rid, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": GENERIC_MESSAGE, "request_id": rid})


class CatchAllMiddleware:
    """Turns an unhandled exception into the generic 500, inside the CORS layer."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def tracked(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked)
        except Exception as exc:
            if started:
                raise
            response = server_error(Request(scope), exc)
            await response(scope, receive, send)


class UploadSizeMiddleware:
    """Refuses an oversized upload from its Content-Length, before the body is read."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["method"] == "POST" and scope["path"] == UPLOAD_PATH:
            declared = dict(scope["headers"]).get(b"content-length", b"")
            if declared.isdigit() and int(declared) > settings.max_upload_bytes + UPLOAD_OVERHEAD_BYTES:
                limit_gb = settings.max_upload_bytes // (1024 ** 3)
                response = JSONResponse(
                    status_code=413, content={"detail": f"That file is larger than the {limit_gb} GB limit."}
                )
                return await response(scope, receive, send)
        await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    """Gives every request an id and every response the standard hardening headers."""

    HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    }
    HSTS = "max-age=63072000; includeSubDomains"

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        rid = new_request_id()
        scope.setdefault("state", {})["request_id"] = rid

        async def with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in self.HEADERS.items():
                    headers[name] = value
                if not settings.is_development:
                    headers["Strict-Transport-Security"] = self.HSTS
                headers["X-Request-ID"] = rid
            await send(message)

        await self.app(scope, receive, with_headers)
