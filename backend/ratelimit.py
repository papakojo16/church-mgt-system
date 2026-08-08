import time
from collections import defaultdict

from fastapi import HTTPException, Request


class InMemoryRateLimiter:
    # Sliding-window limiter. Kept in memory (per process) for simplicity;
    # a Redis-based store would be needed for multi-worker deployments.
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits = defaultdict(list)

    def check(self, key: str):
        # Raise 429 when the key (e.g. an IP or username) exceeds `limit`
        # requests within the sliding window.
        now = time.monotonic()
        bucket = self._hits[key]
        # Drop timestamps that have fallen outside the current window.
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.pop(0)
        if len(bucket) >= self.limit:
            raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
        bucket.append(now)

    def reset(self, key: str):
        # Clear the history for a key, e.g. after a successful login.
        self._hits.pop(key, None)


def client_ip(request: Request) -> str:
    # Rate-limit key; uses the direct socket peer (no proxy headers trusted).
    return request.client.host if request.client else "unknown"


# Login: 10 attempts per 5 minutes. Registration: 5 accounts per hour per IP.
login_limiter = InMemoryRateLimiter(limit=10, window_seconds=300)
register_limiter = InMemoryRateLimiter(limit=5, window_seconds=3600)
