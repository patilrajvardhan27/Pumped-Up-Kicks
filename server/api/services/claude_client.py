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
from dataclasses import dataclass, field
from typing import Dict, Iterator, List, Optional

import anthropic

from api.config import settings as _settings

log = logging.getLogger(__name__)

NOT_CONFIGURED = "The service isn't configured yet."


def _conf(name: str, default):
    """Prefer the app settings; fall back to the raw environment."""
    if _settings is not None and hasattr(_settings, name.lower()):
        return getattr(_settings, name.lower())
    value = os.getenv(name)
    if value is None:
        return default
    return type(default)(value) if not isinstance(default, str) else value


# Model + pricing. Prices are USD per 1M tokens on the Claude API.
# Cache reads are ~0.1x input, cache writes ~1.25x input.
DEFAULT_MODEL = _conf("PUK_CLAUDE_MODEL", "claude-sonnet-5")

PRICING: Dict[str, Dict[str, float]] = {
    "claude-sonnet-5": {"input": 3.00, "output": 15.00},
    "claude-opus-5": {"input": 5.00, "output": 25.00},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
}

# Effort controls how much the model thinks before answering. "low" is the
# right default for grounded lecture Q&A -- the answer is already in the
# retrieved context, so deep reasoning mostly buys latency and tokens.
DEFAULT_EFFORT = _conf("PUK_CLAUDE_EFFORT", "low")

# Lecture answers are deliberately short. This caps a runaway response; it
# costs nothing unless the tokens are actually generated.
DEFAULT_MAX_TOKENS = int(_conf("PUK_CLAUDE_MAX_TOKENS", 2000))


@dataclass
class ClaudeUsage:
    """Token counts and derived cost for one call."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    model: str = DEFAULT_MODEL
    cost_usd: float = field(default=0.0)

    @classmethod
    def from_response_usage(cls, usage, model: str) -> "ClaudeUsage":
        u = cls(
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_write_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
            model=model,
        )
        u.cost_usd = u.compute_cost()
        return u

    def compute_cost(self) -> float:
        rates = PRICING.get(self.model, PRICING[DEFAULT_MODEL])
        per_input = rates["input"] / 1_000_000
        per_output = rates["output"] / 1_000_000
        return round(
            self.input_tokens * per_input
            + self.cache_read_tokens * per_input * 0.1
            + self.cache_write_tokens * per_input * 1.25
            + self.output_tokens * per_output,
            6,
        )

    def to_dict(self) -> Dict:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cache_write_tokens": self.cache_write_tokens,
            "model": self.model,
            "cost_usd": self.cost_usd,
        }


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
