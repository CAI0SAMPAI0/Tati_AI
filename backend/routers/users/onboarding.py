"""
Router de Onboarding — salva e lê a flag has_seen_onboarding no perfil do usuário.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import get_client
from services.upstash import cache_get, cache_set, cache_delete

router = APIRouter()


class OnboardingUpdate(BaseModel):
    has_seen_onboarding: bool = True


@router.get("/users/onboarding")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Retorna se o usuário já completou o onboarding da tabela user_onboarding."""
    username = current_user["username"]
    cache_key = f"onboarding:{username}"

    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    db = get_client()
    rows = (
        db.table("user_onboarding")
        .select("has_seen_onboarding")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    # Se não existir linha na user_onboarding, assume False (novo usuário)
    has_seen = rows[0].get("has_seen_onboarding", False) if rows else False
    result = {"has_seen_onboarding": bool(has_seen)}
    await cache_set(cache_key, result, ttl=3600)
    return result


@router.post("/users/onboarding")
async def mark_onboarding_done(
    body: OnboardingUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Marca o onboarding como concluído na tabela dedicada."""
    username = current_user["username"]
    db = get_client()

    db.table("user_onboarding").upsert({
        "username": username,
        "has_seen_onboarding": body.has_seen_onboarding
    }).execute()

    await cache_delete(f"onboarding:{username}")
    return {"ok": True, "has_seen_onboarding": body.has_seen_onboarding}
