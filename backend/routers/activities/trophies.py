"""
Troféus conquistados pelo aluno.
"""
from fastapi import APIRouter, Depends
from routers.deps import get_current_user, require_staff
from services.database import get_client

router = APIRouter()


@router.get("/")
async def my_trophies(current_user: dict = Depends(get_current_user)):
    """Troféus do aluno logado."""
    return (
        get_client()
        .table("trophies")
        .select("type, title, icon, earned_at")
        .eq("username", current_user["username"])
        .order("earned_at", desc=True)
        .execute()
        .data
    )


@router.get("/admin/{username}")
async def student_trophies(username: str, current_user: dict = Depends(require_staff)):
    """Admin: troféus de um aluno específico."""
    return (
        get_client()
        .table("trophies")
        .select("type, title, icon, earned_at")
        .eq("username", username)
        .order("earned_at", desc=True)
        .execute()
        .data
    )