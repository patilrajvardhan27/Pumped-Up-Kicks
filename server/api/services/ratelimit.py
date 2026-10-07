"""
Per-user rate limits for the endpoints that cost money or CPU.

The monthly dollar quota already caps spend; this stops a script (or a stuck
retry loop) from burning through it in seconds, and stops uploads from being
hammered. Limits are counted in memory, so each API process keeps its own
window. With several replicas the effective limit is multiplied; move the
counters to Redis when that matters.
"""
import math
import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from api.deps import Ctx, RequestContext


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> float | None:
        """Record a request. Returns seconds to wait if the limit is exceeded, else None."""
        now = time.monotonic()
        with self._lock:
            window = self._hits[key]
            while window and now - window[0] >= self.window:
                window.popleft()

            if len(window) >= self.limit:
                return self.window - (now - window[0])

            window.append(now)
            # Keys that stop sending requests would otherwise stay in the map forever.
            if len(self._hits) > 10_000:
                self._hits = defaultdict(
                    deque, {k: v for k, v in self._hits.items() if v and now - v[-1] < self.window}
                )
            return None


def rate_limit(scope: str, limit: int, window_seconds: float = 60):
    """A route dependency: at most `limit` calls per `window_seconds` per signed-in user."""
    limiter = SlidingWindowLimiter(limit, window_seconds)

    def dependency(ctx: RequestContext = Ctx) -> None:
        if limit <= 0:  # 0 switches the limit off
            return
        retry_after = limiter.hit(f"{scope}:{ctx.user_id}")
        if retry_after is not None:
            wait = max(1, math.ceil(retry_after))
            raise HTTPException(
                status_code=429,
                detail=f"You are sending requests too quickly. Try again in {wait}s.",
                headers={"Retry-After": str(wait)},
            )

    return Depends(dependency)
