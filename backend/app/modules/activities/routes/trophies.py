from __future__ import annotations

from app.core.dependencies.auth import get_current_user, require_staff
from app.modules.activities.services.trophy_service import TrophyService
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/")
@router.get("/all")
async def my_trophies(
    current_user: dict = Depends(get_current_user), service: TrophyService = Depends()
):
    """Troféus do aluno logado."""
    return await service.get_user_trophies(current_user["username"])


@router.get("/admin/{username}")
async def student_trophies(
    username: str,
    current_user: dict = Depends(require_staff),
    service: TrophyService = Depends(),
):
    """Admin: troféus de um aluno específico."""
    return await service.get_user_trophies(username)
