"""
What a caller is allowed to see when something fails.

Exceptions carry file paths, SQL, library text and sometimes secrets, so a
response never includes one. Real errors go to the log with a request id the
student can quote; the response gets fixed, readable text.
"""
import logging
import uuid

log = logging.getLogger("api.errors")

GENERIC_MESSAGE = "Something went wrong. Try again."
NOT_CONFIGURED_MESSAGE = "The service isn't configured yet."


class PublicError(Exception):
    """An error whose message was written to be shown to the user."""


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


def request_id(request) -> str:
    """The id for this request, made by the middleware, or a fresh one outside it."""
    return getattr(request.state, "request_id", None) or new_request_id()


def public_message(exc: BaseException, fallback: str = GENERIC_MESSAGE) -> str:
    """
    Text that is safe to show for `exc`. Logs the real error either way, and
    only passes the message through for errors written for the user.
    """
    log.error("%s: %s", type(exc).__name__, exc, exc_info=exc)
    if isinstance(exc, PublicError):
        return str(exc)
    return fallback
