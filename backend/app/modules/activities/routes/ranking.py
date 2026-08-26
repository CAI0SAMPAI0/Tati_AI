"""
Router de Rankings de Atividades.
Refatorado para usar ActivityService.
"""

from app.modules.activities.services.activity_service import ActivityService
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("")
@router.get("/")
async def get_ranking(
    category: str = "global", limit: int = 20, service: ActivityService = Depends()
):
    """Retorna o ranking de usuários."""
    return await service.get_ranking(category, limit)
