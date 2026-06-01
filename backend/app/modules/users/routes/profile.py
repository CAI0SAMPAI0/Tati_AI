"""
Router de perfil do usuário: leitura, atualização e upload de avatar.
Refatorado para usar UserService e padrão async.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies.auth import get_current_user
from app.modules.users.services.user_service import UserService

router = APIRouter()

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    level: Optional[str] = None
    focus: Optional[str] = None
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    cpf: Optional[str] = None
    cpf_cnpj: Optional[str] = None


@router.get('')
async def get_profile(
        user=Depends(get_current_user),
        service: UserService = Depends()):
    return await service.get_profile(user['username'])


@router.put('')
async def update_profile(
    body: ProfileUpdate,
    user=Depends(get_current_user),
    service: UserService = Depends(),
):
    return await service.update_profile(
        user['username'], body.model_dump(exclude_unset=True)
    )


@router.post('/avatar')
async def upload_avatar(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    service: UserService = Depends(),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, 'Tipo não suportado')

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(400, 'Arquivo muito grande')

    url = await service.upload_avatar(user['username'], contents, file.content_type)
    return {'ok': True, 'avatar_url': url}
