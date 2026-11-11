"""
Stand-ins for the two things tests never call for real: the embedding model and
Claude.
"""
import hashlib
import math
import re
from typing import Optional


class HashingEmbedder:
    """Bag of words hashed into the real model's 384 dimensions, L2-normalised."""

    embedding_dim = 384

    def _vector(self, text_: str):
        vector = [0.0] * self.embedding_dim
        for word in re.findall(r"\w+", text_.lower()):
            index = int(hashlib.md5(word.encode()).hexdigest(), 16) % self.embedding_dim
            vector[index] += 1.0
        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            vector[0], norm = 1.0, 1.0
        return [v / norm for v in vector]

    def embed_one(self, text_: str):
        return self._vector(text_)

    def embed_many(self, texts, batch_size: int = 64):
        return [self._vector(t) for t in texts]


class FakeClaude:
    """Answers with a fixed reply and records what it was sent."""

    USAGE = {
        "input_tokens": 100, "output_tokens": 5, "cache_read_tokens": 0,
        "cache_write_tokens": 0, "model": "test-model", "cost_usd": 0.001,
    }

    def __init__(self, reply: str = "It is covered [0:10]."):
        self.reply = reply
        self.prompts: list[str] = []

    def stream(self, system, user):
        self.prompts.append(user)
        yield {"type": "delta", "text": self.reply}
        yield {"type": "done", "text": self.reply, "usage": dict(self.USAGE)}

    def complete(self, system, user, max_tokens: Optional[int] = None):
        from api.services.claude_usage import ClaudeUsage

        self.prompts.append(user)
        usage = ClaudeUsage(**{k: v for k, v in self.USAGE.items() if k != "cost_usd"})
        usage.cost_usd = self.USAGE["cost_usd"]
        return {"text": self.reply, "usage": usage, "stop_reason": "end_turn", "elapsed": 0.0}
