from __future__ import annotations

import json
from typing import Any, Dict, Optional

from core.config import settings
from services.database import get_client

try:
    from pywebpush import WebPushException, webpush
except Exception:  # pragma: no cover - dependência opcional em ambiente local.
    WebPushException = Exception
    webpush = None


def _is_push_configured() -> bool:
    return bool(
        webpush
        and settings.vapid_public_key
        and settings.vapid_private_key
        and settings.vapid_contact
    )


def get_public_vapid_key() -> str:
    return settings.vapid_public_key or ""


def save_push_subscription(
    username: str,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str = "",
) -> bool:
    if not username or not endpoint or not p256dh or not auth:
        return False

    payload = {
        "username": username,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "user_agent": user_agent or "",
        "is_active": True,
    }
    db = get_client()
    try:
        db.table("push_subscriptions").upsert(payload, on_conflict="username,endpoint").execute()
        return True
    except Exception as exc:
        print(f"[Push] Falha ao salvar subscription: {exc}")
        return False


def disable_push_subscription(username: str, endpoint: str) -> None:
    if not endpoint:
        return
    db = get_client()
    try:
        query = db.table("push_subscriptions").update({"is_active": False}).eq("endpoint", endpoint)
        if username:
            query = query.eq("username", username)
        query.execute()
    except Exception as exc:
        print(f"[Push] Falha ao desativar subscription: {exc}")


def _user_subscriptions(username: str) -> list[dict[str, Any]]:
    if not username:
        return []
    db = get_client()
    try:
        rows = (
            db.table("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("username", username)
            .eq("is_active", True)
            .execute()
            .data
        )
        return rows or []
    except Exception as exc:
        print(f"[Push] Falha ao carregar subscriptions: {exc}")
        return []


def send_push_to_user(username: str, title: str, body: str, url: str = "/") -> Dict[str, int]:
    if not _is_push_configured():
        return {"sent": 0, "failed": 0}

    sent = 0
    failed = 0
    for row in _user_subscriptions(username):
        endpoint = str(row.get("endpoint") or "").strip()
        subscription_info = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": str(row.get("p256dh") or ""),
                "auth": str(row.get("auth") or ""),
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_contact},
                ttl=60 * 60,
            )
            sent += 1
        except WebPushException as exc:
            failed += 1
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in {404, 410}:
                disable_push_subscription(username=username, endpoint=endpoint)
        except Exception:
            failed += 1

    return {"sent": sent, "failed": failed}
