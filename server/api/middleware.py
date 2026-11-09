"""
Transport-level protection for every response.

- In production, a request that reached us over plain http (as reported by the
  TLS-terminating proxy) is redirected to https before any handler runs.
- Unhandled exceptions become a generic 500 with a reference id. This runs
  inside the CORS middleware, so the browser can read the message instead of
  reporting a CORS failure.
- Security headers are added to everything the API sends.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from api.config import settings
from api.errors import error_response, safe_detail

BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

PRODUCTION_HEADERS = {
    # No `preload`: that is hard to undo.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    # The API serves JSON and video, never pages, so nothing may run or frame it.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


def _security_headers(path: str) -> dict:
    headers = dict(BASE_HEADERS)
    if settings.is_production:
        headers.update(PRODUCTION_HEADERS)
    if path.startswith("/api/"):
        # Answers, transcripts and signed URLs must not sit in shared caches.
        headers["Cache-Control"] = "no-store"
    return headers


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def harden(request: Request, call_next):
        if settings.is_production and request.headers.get("x-forwarded-proto") == "http":
            return RedirectResponse(str(request.url.replace(scheme="https")), status_code=308)

        try:
            response = await call_next(request)
        except Exception as exc:  # last line of defence; routes handle the expected cases
            detail = safe_detail(exc, f"{request.method} {request.url.path}")
            response = error_response(500, detail)

        for name, value in _security_headers(request.url.path).items():
            response.headers.setdefault(name, value)
        return response

    # Added last so it wraps everything above, error responses included.
    # The API authenticates with a bearer header, never cookies, so credentials
    # are off and only the methods and headers the client sends are allowed.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )
