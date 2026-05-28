import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

settings = get_settings()

_requests: dict[str, deque[float]] = defaultdict(deque)


def _client_host(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


async def auth_rate_limit(request: Request) -> None:
    max_requests = settings.AUTH_RATE_LIMIT_MAX_REQUESTS
    window_seconds = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
    if max_requests <= 0 or window_seconds <= 0:
        return

    now = time.monotonic()
    key = f"auth:{_client_host(request)}:{request.url.path}"
    timestamps = _requests[key]
    while timestamps and now - timestamps[0] >= window_seconds:
        timestamps.popleft()

    if len(timestamps) >= max_requests:
        retry_after = max(1, int(window_seconds - (now - timestamps[0])))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again shortly.",
            headers={"Retry-After": str(retry_after)},
        )

    timestamps.append(now)
