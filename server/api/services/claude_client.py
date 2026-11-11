"""
Claude API client for Pumped Up Kicks.

Single place the app talks to Anthropic. Everything else (RAG services, study
tools) goes through this so model choice, cost accounting, and error handling
live in one file.

Requires ANTHROPIC_API_KEY in the environment (see server/.env.example).
"""
import logging
import os
import time
from typing import Dict, Iterator, List, Optional

import anthropic

from api.config import settings as _settings
from api.services.claude_usage import DEFAULT_EFFORT, DEFAULT_MAX_TOKENS, DEFAULT_MODEL, ClaudeUsage

log = logging.getLogger(__name__)

NOT_CONFIGURED = "The service isn't configured yet."


class ClaudeNotConfigured(RuntimeError):
    """Raised when no Anthropic credentials are available."""


class ClaudeClient:
    """Thin wrapper over the Anthropic SDK with cost accounting built in."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        effort: str = DEFAULT_EFFORT,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        timeout: float = 120.0,
    ):
        self.model = model
        self.effort = effort
        self.max_tokens = max_tokens
        # The key from server/.env lives on the settings object; pydantic-settings
        # does not export it to os.environ, so it has to be passed in explicitly.
        # With none configured the SDK still resolves ANTHROPIC_API_KEY,
        # ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile (scripts, Modal).
        api_key = getattr(_settings, "anthropic_api_key", None) or None
        try:
            self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=3)
        except Exception as e:
            raise ClaudeNotConfigured(
                "No Claude API key found. Set ANTHROPIC_API_KEY in the server environment."
            ) from e
        print(f"[Claude] Client ready (model={model}, effort={effort})")

    # -- helpers ---------------------------------------------------------

    def _request_kwargs(self, system: str, messages: List[Dict], max_tokens: Optional[int]) -> Dict:
        return {
            "model": self.model,
            "max_tokens": max_tokens or self.max_tokens,
            "system": system,
            "messages": messages,
            "thinking": {"type": "adaptive"},
            "output_config": {"effort": self.effort},
        }

    def count_tokens(self, system: str, messages: List[Dict]) -> int:
        """Token count for a request, before sending it. Used to guard context size."""
        result = self._client.messages.count_tokens(
            model=self.model, system=system, messages=messages
        )
        return result.input_tokens

    # -- completion ------------------------------------------------------

    def complete(
        self,
        system: str,
        user_message: str,
        max_tokens: Optional[int] = None,
    ) -> Dict:
        """
        Send one grounded question and return the answer plus usage.

        Returns {"text": str, "usage": ClaudeUsage, "stop_reason": str, "elapsed": float}
        """
        messages = [{"role": "user", "content": user_message}]
        started = time.time()

        response = self._client.messages.create(
            **self._request_kwargs(system, messages, max_tokens)
        )

        text = "".join(b.text for b in response.content if b.type == "text").strip()
        usage = ClaudeUsage.from_response_usage(response.usage, self.model)

        if response.stop_reason == "refusal":
            category = getattr(response.stop_details, "category", None)
            text = (
                "Claude declined to answer this question"
                + (f" ({category})." if category else ".")
                + " Try rephrasing it."
            )

        return {
            "text": text,
            "usage": usage,
            "stop_reason": response.stop_reason,
            "elapsed": round(time.time() - started, 2),
            "request_id": response._request_id,
        }

    def stream(
        self,
        system: str,
        user_message: str,
        max_tokens: Optional[int] = None,
    ) -> Iterator[Dict]:
        """
        Stream an answer token by token.

        Yields {"type": "delta", "text": str} for each chunk, then a final
        {"type": "done", "text": full_text, "usage": {...}, "elapsed": float}.
        """
        messages = [{"role": "user", "content": user_message}]
        started = time.time()

        with self._client.messages.stream(
            **self._request_kwargs(system, messages, max_tokens)
        ) as stream:
            for chunk in stream.text_stream:
                yield {"type": "delta", "text": chunk}

            final = stream.get_final_message()

        text = "".join(b.text for b in final.content if b.type == "text").strip()
        usage = ClaudeUsage.from_response_usage(final.usage, self.model)

        yield {
            "type": "done",
            "text": text,
            "usage": usage.to_dict(),
            "stop_reason": final.stop_reason,
            "elapsed": round(time.time() - started, 2),
        }


def describe_api_error(exc: Exception) -> str:
    """
    Turn an SDK exception into something a student can act on. The real error is
    logged; configuration problems and anything unknown show fixed text only.
    """
    log.error("Claude call failed: %s: %s", type(exc).__name__, exc)
    if isinstance(exc, ClaudeNotConfigured):
        return NOT_CONFIGURED
    if isinstance(exc, (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.NotFoundError)):
        return NOT_CONFIGURED
    if isinstance(exc, anthropic.RateLimitError):
        retry_after = exc.response.headers.get("retry-after", "60")
        if not str(retry_after).isdigit():
            retry_after = "60"
        return f"Claude is busy right now. Retry in {retry_after}s."
    if isinstance(exc, anthropic.BadRequestError):
        return "Claude couldn't process that request. Try rephrasing it."
    if isinstance(exc, anthropic.APIStatusError):
        if exc.status_code == 529 or exc.status_code >= 500:
            return "Claude is overloaded or having trouble on its side. Retry in a moment."
        return "Claude couldn't answer right now. Try again."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Couldn't reach Claude. Try again in a moment."
    if isinstance(exc, TypeError) and "authentication method" in str(exc):
        return NOT_CONFIGURED
    return "Something went wrong while asking Claude. Try again."


_client: Optional[ClaudeClient] = None


def get_claude_client() -> ClaudeClient:
    """Process-wide Claude client. Created on first use."""
    global _client
    if _client is None:
        if not (
            getattr(_settings, "anthropic_api_key", None)
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("ANTHROPIC_AUTH_TOKEN")
        ):
            # The SDK can still find an `ant auth login` profile, so this is a
            # warning rather than a hard failure.
            print("[Claude] ANTHROPIC_API_KEY not set -- falling back to CLI credentials")
        _client = ClaudeClient()
    return _client
