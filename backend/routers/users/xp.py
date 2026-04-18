"""
Router de Sistema de XP e Níveis.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.xp_system import get_xp_data, award_xp, get_leaderboard, get_user_rank

router = APIRouter()


class XpAward(BaseModel):
    amount: int
    reason: str


@router.get("/xp")
async def get_user_xp(current_user: dict = Depends(get_current_user)):
    """Retorna XP e nível do usuário."""
    return get_xp_data(current_user["username"])


@router.post("/xp/award")
async def award_user_xp(body: XpAward, current_user: dict = Depends(get_current_user)):
    """Adiciona XP ao usuário."""
    return award_xp(current_user["username"], body.amount, body.reason)


@router.get("/xp/leaderboard")
async def get_leaderboard_endpoint():
    """Ranking de alunos."""
    return {"leaderboard": get_leaderboard()}


@router.get("/xp/rank")
async def get_my_rank(current_user: dict = Depends(get_current_user)):
    """Retorna posição do usuário no ranking."""
    return get_user_rank(current_user["username"])
