from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.core.database import get_client
from app.shared.services.upstash import cache_get, cache_set

router = APIRouter()


@router.get('/bootstrap')
async def get_bootstrap(
        current_user: dict = Depends(get_current_user)) -> dict:
    username = current_user['username']
    cache_key = f'bootstrap:{username}'

    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()

    from app.modules.users.services.streaks import get_streak

    streak_data = get_streak(username)
    streak = {
        'current_streak': streak_data.get('current_streak', 0),
        'longest_streak': streak_data.get('longest_streak', 0),
    }

    try:
        notif_rows = (
            db.table('notifications')
            .select('id', count='exact')
            .eq('username', username)
            .eq('read', False)
            .execute()
        )
        unread_notifications = notif_rows.count or 0
    except Exception:
        unread_notifications = 0

    from app.modules.users.services.xp_system import get_xp_data

    xp = get_xp_data(username)

    try:
        earned = (
            db.table('user_trophies')
            .select('id', count='exact')
            .eq('username', username)
            .execute()
        )
        trophies_earned = earned.count or 0
    except Exception:
        trophies_earned = 0

    result = {
        'streak': streak,
        'unread_notifications': unread_notifications,
        'xp': xp,
        'trophies_earned': trophies_earned,
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


@router.get('/notification-preferences')
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user)
) -> dict:
    username = current_user['username']
    db = get_client()
    try:
        res = db.table('users').select('profile').eq('username', username).execute()
        if res.data:
            profile = res.data[0].get('profile') or {}
            prefs = profile.get('notification_preferences')
            if prefs:
                return prefs
    except Exception:
        pass

    return {
        "streaks": {"email": True, "push": True},
        "challenges": {"email": True, "push": True},
        "cefr": {"email": True, "push": True}
    }


@router.put('/notification-preferences')
async def update_notification_preferences(
    payload: NotificationPrefsSchema,
    current_user: dict = Depends(get_current_user)
) -> dict:
    username = current_user['username']
    db = get_client()
    try:
        res = db.table('users').select('profile').eq('username', username).execute()
        profile = (res.data[0].get('profile') or {}) if res.data else {}
        profile['notification_preferences'] = payload.model_dump()

        db.table('users').update({'profile': profile}).eq('username', username).execute()

        from app.shared.services.upstash import cache_delete
        await cache_delete(f'profile:{username}')
        await cache_delete(f'bootstrap:{username}')
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {str(e)}"
        )

    return {"status": "success", "preferences": profile['notification_preferences']}
