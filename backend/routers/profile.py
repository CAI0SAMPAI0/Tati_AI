from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import get_client
import base64

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    level: str | None = None
    focus: str | None = None
    nickname: str | None = None
    occupation: str | None = None


def _get_avatar(row: dict) -> str | None:
    """
    Tenta ler avatar_url da coluna dedicada.
    Se a coluna não existir ainda, cai para profile->avatar_url.
    """
    # Coluna de nível superior (após migration)
    if "avatar_url" in row and row["avatar_url"]:
        return row["avatar_url"]
    # Fallback: campo dentro do JSON 'profile'
    profile = row.get("profile") or {}
    return profile.get("avatar_url")


@router.get("/")
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_client()

    # Tenta buscar com avatar_url; se falhar, busca sem
    try:
        rows = (
            db.table("users")
            .select("username, name, email, role, level, focus, created_at, profile, avatar_url")
            .eq("username", current_user["username"])
            .limit(1)
            .execute()
            .data
        )
    except Exception:
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

    row = rows[0]
    row["avatar_url"] = _get_avatar(row)
    return row


@router.put("/")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_client()
    username = current_user["username"]

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

    profile = rows[0].get("profile") or {}
    for field in ("nickname", "occupation"):
        val = getattr(body, field)
        if val is not None:
            profile[field] = val

    update_data = {**top_level, "profile": profile}
    db.table("users").update(update_data).eq("username", username).execute()
    return {"ok": True, "updated": update_data}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo não suportado: {file.content_type}. Use JPEG, PNG ou WebP.",
        )

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 5 MB).")

    b64 = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64}"

    db = get_client()
    username = current_user["username"]

    # Tenta salvar na coluna avatar_url (requer migration SQL)
    # Se a coluna não existir, salva dentro do JSON profile
    saved_in_column = False
    try:
        db.table("users").update({"avatar_url": data_url}).eq("username", username).execute()
        saved_in_column = True
    except Exception:
        pass

    if not saved_in_column:
        # Fallback: guarda em profile->avatar_url
        rows = (
            db.table("users")
            .select("profile")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
        profile = (rows[0].get("profile") or {}) if rows else {}
        profile["avatar_url"] = data_url
        db.table("users").update({"profile": profile}).eq("username", username).execute()

    return {"ok": True, "avatar_url": data_url}