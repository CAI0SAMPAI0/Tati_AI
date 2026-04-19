"""
Router de Sistema de XP e Níveis.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.xp_system import get_xp_data, award_xp, get_leaderboard, get_user_rank
from services.upstash import cache_get, cache_set, cache_delete

router = APIRouter()


class XpAward(BaseModel):
    amount: int
    reason: str


@router.get("/xp")
async def get_user_xp(current_user: dict = Depends(get_current_user)):
    """Retorna XP e nível do usuário."""
    username = current_user["username"]
    cache_key = f"xp:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = get_xp_data(username)
    await cache_set(cache_key, result, ttl=180)  # 3 minutos
    return result


@router.post("/xp/award")
async def award_user_xp(body: XpAward, current_user: dict = Depends(get_current_user)):
    """Adiciona XP ao usuário."""
    username = current_user["username"]
    result = award_xp(username, body.amount, body.reason)
    await cache_delete(f"xp:{username}")  # invalida ao ganhar XP
    return result


@router.get("/xp/leaderboard")
async def get_leaderboard_endpoint():
    """Ranking de alunos."""
    cache_key = "xp:leaderboard"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = {"leaderboard": get_leaderboard()}
    await cache_set(cache_key, result, ttl=300)  # 5 minutos
    return result


@router.get("/xp/rank")
async def get_my_rank(current_user: dict = Depends(get_current_user)):
    """Retorna posição do usuário no ranking."""
    username = current_user["username"]
    cache_key = f"xp:rank:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = get_user_rank(username)
    await cache_set(cache_key, result, ttl=300)
    return result
