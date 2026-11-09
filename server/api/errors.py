"""
What a user sees when something breaks.

The full detail (exception text, SQL, file paths, stack trace) goes to the server
log under a short reference id. In production the response carries a plain
sentence and that id, so a student can report the problem without the API
handing out a map of its internals. In development the raw detail is returned,
because that is what a developer needs.
"""
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError

from api.config import settings

log = logging.getLogger("kicks")

GENERIC = "Something went wrong on our side. Try again in a moment."
UNAVAILABLE = "The service is temporarily unavailable. Try again in a moment."


def _reference(detail: object, where: str) -> str:
    ref = uuid.uuid4().hex[:8]
    if isinstance(detail, BaseException):
        log.error("[%s] ref=%s %s", where, ref, detail, exc_info=detail)
    else:
        log.error("[%s] ref=%s %s", where, ref, detail)
    return ref


def safe_detail(detail: object, where: str, public: str = GENERIC, dev: str | None = None) -> str:
    """
    Log `detail` (an exception or an internal message) and return text that is
    safe to put in a response or store where the user can read it.

    `dev` is an optional friendlier message for development; it defaults to the
    raw detail.
    """
    ref = _reference(detail, where)
    if settings.is_production:
        return f"{public} (ref {ref})"
    return dev or str(detail) or public


def error_response(status_code: int, detail: str, **headers: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail}, headers=headers or None)


def install(app: FastAPI) -> None:
    @app.exception_handler(OperationalError)
    @app.exception_handler(InterfaceError)
    async def database_unavailable(request: Request, exc: Exception) -> JSONResponse:
        """
        A database that can't be reached is an outage, not a server bug.

        One log line, not the 250-line SQLAlchemy chain, which repeats on every poll.
        """
        reason = str(getattr(exc, "orig", exc)).strip().splitlines()[0]
        log.warning("[Database] %s %s: %s", request.method, request.url.path, reason)
        detail = UNAVAILABLE if settings.is_production else (
            "Can't reach the database. Check that Postgres is running and that "
            "DATABASE_URL in server/.env is correct."
        )
        return error_response(503, detail, **{"Retry-After": "5"})
