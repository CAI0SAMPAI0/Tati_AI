from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import get_client

router = APIRouter()

class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    level: str | None = None
    focus: str | None = None
    nickname: str | None = None
    occupation: str | None = None

@router.get("/")
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_client()
    rows = (
        db.table("users")
        .select("username, name, email, role, level, focus, created_at, profile")
        .eq("username", current_user["username"])
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return rows[0]

@router.put("/")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_client()
    username = current_user["username"]
    # busca o perfil atual para merge
    rows = (
        db.table("users")
        .select("profile")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    top_level = {}
    for field in ["name", "email", "level", "focus"]:
        val = getattr(body, field)
        if val is not None:
            top_level[field] = val

        # campos para JSON do perfil
    profile = rows[0].get("profile") or {}
    for field in ("nickname", "occupation"):
        val = getattr(body, field)
        if val is not None:
            profile[field] = val

    update_data = {**top_level, "profile": profile}
    result = (
        db.table("users")
        .update(update_data)
        .eq("username", username)
        .execute()
    )

    return {"ok": True, "updated": update_data}