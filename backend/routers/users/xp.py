"""
Router para Gerenciamento de XP.
Refatorado para usar GamificationService.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from routers.deps import get_current_user
from services.gamification_service import GamificationService

router = APIRouter()


class XPRecord(BaseModel):
    amount: int
    reason: str


@router.get('/')
@router.get('')
async def get_xp(
    user=Depends(get_current_user), service: GamificationService = Depends()
):
    """Retorna o XP atual do usuário."""
    return await service.get_user_xp(user['username'])


@router.post('/award')
async def award_xp(
    body: XPRecord,
    user=Depends(get_current_user),
    service: GamificationService = Depends(),
):
    """Atribui XP ao usuário (uso administrativo ou interno)."""
    return await service.award_xp(user['username'], body.amount, body.reason)
