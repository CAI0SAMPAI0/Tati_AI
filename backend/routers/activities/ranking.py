"""
Router para o Ranking de Alunos.
"""
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.ranking import get_ranking_data
from services.upstash import cache_get, cache_set

router = APIRouter()


@router.get("")
async def get_ranking(current_user: dict = Depends(get_current_user)):
    """Retorna os dados do ranking para a tela de competições."""
    username = current_user["username"]

    cache_key = "ranking:global"
    cached = await cache_get(cache_key)
    if cached:
        # Recalcula só a posição do usuário (dado pessoal, não cacheado)
        cached["my_position"] = next(
            (i + 1 for i, x in enumerate(cached.get("top15", [])) if x["username"] == username),
            0
        )
        return cached

    result = get_ranking_data(username)
    
    # Salva sem my_position (varia por usuário)
    to_cache = {**result, "my_position": 0}
    await cache_set(cache_key, to_cache, ttl=300)  # 5 minutos
    return result
