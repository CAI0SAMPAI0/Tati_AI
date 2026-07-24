from __future__ import annotations

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from app.shared.services.upstash import cache_get, cache_set
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter()


@router.get("/bootstrap")
async def get_bootstrap(current_user: dict = Depends(get_current_user)) -> dict:
    username = current_user["username"]
    cache_key = f"bootstrap:{username}"

    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()

    import asyncio

    from app.modules.users.services.streaks import get_streak
    from app.modules.users.services.xp_system import get_xp_data
    from fastapi.concurrency import run_in_threadpool

    # Executa as tarefas concorrentemente para máximo desempenho
    async def fetch_streak():
        try:
            return await get_streak(username)
        except Exception:
            return {}

    async def fetch_notifications():
        try:

            def _fetch():
                return (
                    db.table("notifications")
                    .select("id", count="exact")
                    .eq("username", username)
                    .eq("read", False)
                    .execute()
                )

            res = await run_in_threadpool(_fetch)
            return res.count or 0
        except Exception:
            return 0

    async def fetch_xp():
        try:
            return await run_in_threadpool(get_xp_data, username)
        except Exception:
            return {
                "xp": 0,
                "level": "A1",
                "level_progress": 0,
                "xp_to_next": 500,
                "milestones": [],
                "total_xp_earned": 0,
            }

    async def fetch_trophies():
        try:

            def _fetch():
                return (
                    db.table("user_trophies")
                    .select("id", count="exact")
                    .eq("username", username)
                    .execute()
                )

            res = await run_in_threadpool(_fetch)
            is_programmer = (
                username.lower() in ["caio", "caio007", "caio.sampaio"]
                or "caio" in username.lower()
            )
            return 50 if is_programmer else (res.count or 0)
        except Exception:
            is_programmer = (
                username.lower() in ["caio", "caio007", "caio.sampaio"]
                or "caio" in username.lower()
            )
            return 50 if is_programmer else 0

    streak_data, unread_notifications, xp, trophies_earned = await asyncio.gather(
        fetch_streak(), fetch_notifications(), fetch_xp(), fetch_trophies()
    )

    streak = {
        "current_streak": streak_data.get("current_streak", 0) if streak_data else 0,
        "longest_streak": streak_data.get("longest_streak", 0) if streak_data else 0,
    }

    result = {
        "streak": streak,
        "unread_notifications": unread_notifications,
        "xp": xp,
        "trophies_earned": trophies_earned,
    }

    await cache_set(cache_key, result, ttl=120)
    return result


class NotificationPrefsItem(BaseModel):
    email: bool
    push: bool


class NotificationPrefsSchema(BaseModel):
    streaks: NotificationPrefsItem
    challenges: NotificationPrefsItem
    cefr: NotificationPrefsItem


@router.get("/notification-preferences")
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
) -> dict:
    username = current_user["username"]
    db = get_client()
    try:
        res = db.table("users").select("profile").eq("username", username).execute()
        if res.data:
            profile = res.data[0].get("profile") or {}
            prefs = profile.get("notification_preferences")
            if prefs:
                return prefs
    except Exception:
        pass

    return {
        "streaks": {"email": True, "push": True},
        "challenges": {"email": True, "push": True},
        "cefr": {"email": True, "push": True},
    }


@router.put("/notification-preferences")
async def update_notification_preferences(
    payload: NotificationPrefsSchema, current_user: dict = Depends(get_current_user)
) -> dict:
    username = current_user["username"]
    db = get_client()
    try:
        res = db.table("users").select("profile").eq("username", username).execute()
        profile = (res.data[0].get("profile") or {}) if res.data else {}
        profile["notification_preferences"] = payload.model_dump()

        db.table("users").update({"profile": profile}).eq(
            "username", username
        ).execute()

        from app.shared.services.upstash import cache_delete

        await cache_delete(f"profile:{username}")
        await cache_delete(f"bootstrap:{username}")
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {e!s}",
        )

    return {"status": "success", "preferences": profile["notification_preferences"]}
