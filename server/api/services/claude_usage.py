"""
Model defaults, the price table, and the token and cost record kept for every
Claude call.
"""
import os
from dataclasses import dataclass, field
from typing import Dict

from api.config import settings as _settings


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
