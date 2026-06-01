"""
Router para Gerenciamento de Streaks.
Refatorado para usar GamificationService.
"""

from fastapi import APIRouter, Depends
from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.gamification_service import GamificationService

router = APIRouter()


@router.get('/')
@router.get('')
async def get_streak(
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Retorna o streak atual do usuário."""
    return await service.get_streak_data(user['username'])


@router.post('/record')
async def record_activity(
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Registra atividade diária e atualiza o streak."""
    return await service.update_streak(user['username'])


@router.get('/detail')
async def get_streak_detail(
        user=Depends(get_current_user),
        service: GamificationService = Depends()):
    """Retorna detalhes estatísticos do streak."""
    return await service.get_streak_data(user['username'])
