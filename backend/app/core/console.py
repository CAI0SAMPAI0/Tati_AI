from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def print_log(message: str, username: str | None = None, **context: Any) -> None:
    """Print an application diagnostic line with timestamp and safe context."""
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    parts = [f"[{timestamp}]", f"[user={username or '-'}]"]
    parts.extend(f"[{key}={value}]" for key, value in context.items() if value is not None)
    print(" ".join(parts) + f" {message}", flush=True)
