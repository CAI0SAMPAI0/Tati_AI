from fastapi import APIRouter, Depends
from app.core.dependencies.auth import get_current_user

router = APIRouter()


@router.get('/my')
async def get_my_achievements(user=Depends(get_current_user)):
    """Retorna achievements do usuário."""
    from app.modules.activities.services.trophy_service import TrophyService
    ts = TrophyService()
    return await ts.list_achievements(user['username'])
