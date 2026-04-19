"""
Router para o Ranking de Alunos.
"""
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.ranking import get_ranking_data

router = APIRouter()


@router.get("")
async def get_ranking(current_user: dict = Depends(get_current_user)):
    """Retorna os dados do ranking para a tela de competições."""
    username = current_user["username"]
    return get_ranking_data(username)
