"""
Router para Gerenciamento de Streaks.
Refatorado para usar GamificationService.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.gamification_service import GamificationService

router = APIRouter()


@router.get('/')
@router.get('')
async def get_streak(
        request: Request,
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Retorna o streak atual do usuário."""
    tz = request.headers.get('x-timezone')
    if tz:
        await service.update_user_timezone(user['username'], tz)
    return await service.get_streak_data(user['username'])


@router.post('/record')
async def record_activity(
        request: Request,
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Registra atividade diária e atualiza o streak."""
    tz = request.headers.get('x-timezone')
    if tz:
        await service.update_user_timezone(user['username'], tz)
    return await service.update_streak(user['username'])


@router.get('/detail')
async def get_streak_detail(
        request: Request,
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Retorna detalhes estatísticos do streak."""
    tz = request.headers.get('x-timezone')
    if tz:
        await service.update_user_timezone(user['username'], tz)
    return await service.get_streak_data(user['username'])


@router.post('/purchase-freeze')
async def purchase_streak_freeze(
    user=Depends(get_current_user),
    service: GamificationService = Depends()
):
    username = user['username']
    xp_data = await service.get_user_xp(username)
    user_xp = xp_data.get('xp', 0)

    if user_xp < 150:
        raise HTTPException(
            status_code=400,
            detail="XP insuficiente para comprar Streak Freeze. Custo: 150 XP."
        )

    updated_xp = await service.award_xp(username, -150, "Compra de Streak Freeze")

    res = service.db.table('users').select('streak_data').eq('username', username).single().execute()
    streak_data = res.data.get('streak_data') or {}
    if not isinstance(streak_data, dict):
        streak_data = {}

    freeze_count = streak_data.get('streak_freeze_count', 0) or 0
    if freeze_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="You have already reached the maximum limit of 3 Streak Freezes. Use one before buying another."
        )
    streak_data['streak_freeze_count'] = freeze_count + 1

    service.db.table('users').update({
        'streak_data': streak_data
    }).eq('username', username).execute()

    return {
        "success": True,
        "xp_data": updated_xp,
        "streak_data": streak_data
    }
