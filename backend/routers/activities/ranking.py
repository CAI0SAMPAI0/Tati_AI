"""
Router de Rankings de Atividades.
Refatorado para usar ActivityService.
"""

from fastapi import APIRouter, Depends

from services.activity_service import ActivityService

router = APIRouter()


@router.get('/')
async def get_ranking(
    category: str = 'global', limit: int = 20, service: ActivityService = Depends()
):
    """Retorna o ranking de usuários."""
    return await service.get_ranking(category, limit)
