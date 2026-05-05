from fastapi import APIRouter, Depends
from routers.deps import get_current_user

router = APIRouter()

@router.get('/my')
async def get_my_achievements(user=Depends(get_current_user)):
    """Retorna achievements do usuário."""
    from services.trophy_service import TrophyService
    ts = TrophyService()
    return await ts.list_achievements(user['username'])
