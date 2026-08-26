"""
Router de Onboarding.
Refatorado para aspas simples e padrão async/threadpool.
"""

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from app.shared.services.upstash import cache_delete, cache_get, cache_set
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

router = APIRouter()


class OnboardingUpdate(BaseModel):
    has_seen_onboarding: bool = True


@router.get("")
@router.get("/")
async def get_onboarding_status(user=Depends(get_current_user)):
    """Retorna se o usuário já completou o onboarding."""
    username = user["username"]
    cache_key = f"onboarding:{username}"

    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch():
        db = get_client()
        return (
            db.table("user_onboarding")
            .select("has_seen_onboarding")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )

    rows = await run_in_threadpool(_fetch)
    has_seen = rows[0].get("has_seen_onboarding", False) if rows else False
    result = {"has_seen_onboarding": bool(has_seen)}
    await cache_set(cache_key, result, ttl=3600)
    return result


@router.post("")
@router.post("/")
async def mark_onboarding_done(body: OnboardingUpdate, user=Depends(get_current_user)):
    """Marca o onboarding como concluído."""
    username = user["username"]

    def _update():
        db = get_client()
        db.table("user_onboarding").upsert(
            {"username": username, "has_seen_onboarding": body.has_seen_onboarding}
        ).execute()

    await run_in_threadpool(_update)
    await cache_delete(f"onboarding:{username}")
    return {"ok": True, "has_seen_onboarding": body.has_seen_onboarding}
