import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request, status


class IPRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter per client IP.
    Conforms to SURYA security requirement in spec Section 4.2 & Section 17.
    """

    def __init__(self) -> None:
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def check(
        self,
        request: Request,
        key_prefix: str = "auth",
        max_requests: int = 15,
        window_seconds: int = 60,
    ) -> None:
        """
        Validates rate limit for the client IP.
        Raises HTTP 429 if the request count exceeds max_requests within window_seconds.
        """
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown_ip")
        )
        key = f"{key_prefix}:{client_ip}"
        now = time.monotonic()
        cutoff = now - window_seconds

        # Prune older timestamps
        timestamps = [t for t in self._requests[key] if t > cutoff]
        self._requests[key] = timestamps

        if len(timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - timestamps[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "details": {"retry_after_seconds": max(1, retry_after)},
                },
            )

        self._requests[key].append(now)

    def reset(self) -> None:
        """Resets all tracked request records (for test isolation)."""
        self._requests.clear()


# Global rate limiter singleton
rate_limiter = IPRateLimiter()
