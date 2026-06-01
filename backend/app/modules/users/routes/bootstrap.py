"""
routers/users/bootstrap.py
Endpoint agregado que retorna dados iniciais de uma só vez.

Reduz de ~6 roundtrips para 1 no carregamento de páginas do frontend.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.dependencies.auth import get_current_user
from app.core.database import get_client
from app.shared.services.upstash import cache_get, cache_set

router = APIRouter()


@router.get('/bootstrap')
async def get_bootstrap(
        current_user: dict = Depends(get_current_user)) -> dict:
    """Retorna dados iniciais agregados para o frontend.

    Combina: access, streak, notifications count e XP.
    O frontend pode chamar este endpoint uma vez ao invés de
    fazer 4-6 chamadas separadas.
    """
    import asyncio
    from app.modules.activities.services.podcast_discovery import discover_personalized_podcasts
    username = current_user['username']
    cache_key = f'bootstrap:{username}'

    # Gatilho de descoberta em background (opcional, se não houver cache
    # recente)
    asyncio.create_task(discover_personalized_podcasts(
        username, username, current_user.get('level', 'Intermediate')))

    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()

    # ── Streak ────────────────────────────────────────────────
    from app.modules.users.services.streaks import get_streak

    streak_data = get_streak(username)
    streak = {
        'current_streak': streak_data.get('current_streak', 0),
        'longest_streak': streak_data.get('longest_streak', 0),
    }

    # ── Notifications (count apenas) ─────────────────────────
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

    # ── XP ────────────────────────────────────────────────────
    from app.modules.users.services.xp_system import get_xp_data

    xp = get_xp_data(username)

    # ── Trophies count ────────────────────────────────────────
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

    await cache_set(cache_key, result, ttl=120)  # 2 minutos
    return result
