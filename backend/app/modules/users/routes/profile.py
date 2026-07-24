"""
Router de perfil do usuário: leitura, atualização e upload de avatar.
Refatorado para usar UserService e padrão async.
"""


from app.core.dependencies.auth import get_current_user
from app.modules.users.services.user_service import UserService
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

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
    responsible_email: str | None = None
    whatsapp_number: str | None = None
    allow_whatsapp_notifications: bool | None = None
    whatsapp_onboarded: bool | None = None


@router.get("")
async def get_profile(user=Depends(get_current_user), service: UserService = Depends()):
    return await service.get_profile(user["username"])


@router.put("")
async def update_profile(
    body: ProfileUpdate,
    user=Depends(get_current_user),
    service: UserService = Depends(),
):
    return await service.update_profile(
        user["username"], body.model_dump(exclude_unset=True)
    )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    service: UserService = Depends(),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Tipo não suportado")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(400, "Arquivo muito grande")

    url = await service.upload_avatar(user["username"], contents, file.content_type)
    return {"ok": True, "avatar_url": url}
