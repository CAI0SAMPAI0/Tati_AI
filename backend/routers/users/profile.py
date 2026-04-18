"""
Router de perfil do usuário: leitura, atualização e upload de avatar.
"""
import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from routers.deps import get_current_user
from services.database import get_client
from services.document_validator import validate_document_auto

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    level: str | None = None
    focus: str | None = None
    nickname: str | None = None
    occupation: str | None = None
    cpf: str | None = None
    cpf_cnpj: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_avatar_url(row: dict) -> str | None:
    if row.get("avatar_url"):
        return row["avatar_url"]
    return (row.get("profile") or {}).get("avatar_url")


def get_user_by_username(username: str) -> dict | None:
    """Busca usuário por username. Retorna None se não encontrado."""
    db = get_client()
    try:
        rows = (
            db.table("users")
            .select("username, name, email, role, level, focus, created_at, profile, avatar_url, cpf, cpf_cnpj")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        rows = (
            db.table("users")
            .select("username, name, email, role, level, focus, created_at, profile, cpf, cpf_cnpj")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
    if not rows:
        return None
    row = rows[0]
    row["avatar_url"] = _get_avatar_url(row)
    return row


def _fetch_user(username: str) -> dict:
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return row


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return _fetch_user(current_user["username"])


@router.put("/")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_client()
    username = current_user["username"]

    rows = db.table("users").select("profile").eq("username", username).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Valida CPF/CNPJ se fornecido
    doc_to_validate = body.cpf or body.cpf_cnpj
    if doc_to_validate:
        validation_result = validate_document_auto(doc_to_validate)
        if not validation_result['valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Documento inválido: {validation_result['message']}"
            )
        # Salva o documento formatado
        formatted_doc = validation_result['formatted']
        if body.cpf:
            body.cpf = formatted_doc
        if body.cpf_cnpj:
            body.cpf_cnpj = formatted_doc

    top_level = {f: getattr(body, f) for f in ("name", "email", "level", "focus", "cpf", "cpf_cnpj") if getattr(body, f) is not None}
    profile = rows[0].get("profile") or {}
    for field in ("nickname", "occupation"):
        val = getattr(body, field)
        if val is not None:
            profile[field] = val

    update_data = {**top_level, "profile": profile}
    db.table("users").update(update_data).eq("username", username).execute()
    return {"ok": True, "updated": update_data}


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo não suportado: {file.content_type}. Use JPEG, PNG ou WebP.")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 5 MB).")

    data_url = f"data:{file.content_type};base64,{base64.b64encode(contents).decode()}"
    db = get_client()
    username = current_user["username"]

    try:
        db.table("users").update({"avatar_url": data_url}).eq("username", username).execute()
    except Exception:
        # Fallback: salva dentro do JSON profile
        rows = db.table("users").select("profile").eq("username", username).limit(1).execute().data
        profile = (rows[0].get("profile") or {}) if rows else {}
        profile["avatar_url"] = data_url
        db.table("users").update({"profile": profile}).eq("username", username).execute()

    return {"ok": True, "avatar_url": data_url}