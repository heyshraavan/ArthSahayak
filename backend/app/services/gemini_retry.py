"""Gemini API retry handling for transient errors.

Provides exponential backoff retry for transient Google GenAI errors:
- HTTP 503 (UNAVAILABLE / Service Unavailable / High demand / Overloaded)
- HTTP 429 (RESOURCE_EXHAUSTED / Too Many Requests / Rate limit exceeded)
- Network timeouts / temporary connection resets

Explicitly does NOT retry client/authentication errors:
- HTTP 401 / 403 (Invalid API key / Unauthenticated / Permission denied)
- HTTP 400 (Bad request / Invalid argument)
- HTTP 404 (Not found)
"""

import logging
import time
from typing import Any, Callable

logger = logging.getLogger("arthsahayak.gemini_retry")


def is_transient_gemini_error(err: Exception) -> bool:
    """Determine whether an error from Google GenAI is transient and eligible for retry."""
    # Check numeric error code if available (e.g. from google.genai.errors.APIError)
    code = getattr(err, "code", None)
    if code is None:
        code = getattr(err, "status_code", None)

    if code is not None:
        try:
            int_code = int(code)
            if int_code in (401, 403, 400, 404):
                return False
            if int_code in (503, 429, 502, 504):
                return True
        except (ValueError, TypeError):
            pass

    msg = str(err).lower()
    # Explicit non-retryable auth / permission / client errors
    non_retryable_terms = [
        "401", "403", "unauthenticated", "permission_denied",
        "api_key_invalid", "invalid api key", "api key not valid",
        "forbidden", "invalid_argument", "bad request",
    ]
    if any(term in msg for term in non_retryable_terms):
        return False

    # Retryable transient signals
    retryable_terms = [
        "503", "429", "unavailable", "resource_exhausted",
        "high demand", "overloaded", "rate limit", "too many requests",
        "temporarily unavailable", "deadline exceeded", "timeout",
        "connection reset", "connection refused", "try again later",
    ]
    if any(term in msg for term in retryable_terms):
        return True

    return False


def call_gemini_with_retry(
    generate_content_fn: Callable[..., Any],
    *,
    model: str,
    contents: Any,
    config: Any,
    max_attempts: int = 3,
    initial_backoff_sec: float = 0.5,
    backoff_multiplier: float = 2.0,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> Any:
    """Execute Gemini models.generate_content with exponential backoff on transient errors.

    - Maximum 2-3 attempts (default: 3 attempts).
    - Exponential backoff: initial 0.5s, doubled each retry (0.5s, 1.0s).
    - Immediate failure on non-transient errors (401/403/invalid API key).
    """
    attempt = 1
    current_backoff = initial_backoff_sec

    while True:
        try:
            return generate_content_fn(
                model=model,
                contents=contents,
                config=config,
            )
        except Exception as err:
            if not is_transient_gemini_error(err) or attempt >= max_attempts:
                if attempt > 1:
                    logger.error(
                        "Gemini call failed after %d attempts (model=%s): %s: %s",
                        attempt, model, type(err).__name__, err,
                    )
                raise

            logger.warning(
                "Gemini transient error on attempt %d/%d (model=%s): %s: %s. Retrying in %.2fs...",
                attempt, max_attempts, model, type(err).__name__, err, current_backoff,
            )
            sleep_fn(current_backoff)
            attempt += 1
            current_backoff *= backoff_multiplier
