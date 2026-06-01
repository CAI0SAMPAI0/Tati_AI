"""
Router de Caderno de Vocabulário Pessoal.
Refatorado para usar UserService e padrão async.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.core.dependencies.auth import get_current_user
from app.modules.users.services.user_service import UserService

router = APIRouter()


class VocabWord(BaseModel):
    term: str
    translation: Optional[str] = None
    example: Optional[str] = None
    status: str = 'new'


class VocabUpdate(BaseModel):
    words: List[VocabWord]


@router.get('')
async def get_vocabulary(
    user=Depends(get_current_user), service: UserService = Depends()
):
    """Retorna vocabulário do usuário."""
    return await service.get_vocabulary(user['username'])


@router.post('/add')
async def add_word(
        body: VocabWord,
        user=Depends(get_current_user),
        service: UserService = Depends()):
    """Adiciona uma palavra ao vocabulário."""
    return await service.add_vocabulary_word(user['username'], body.model_dump())


@router.delete('/{term}')
async def delete_word(
        term: str,
        user=Depends(get_current_user),
        service: UserService = Depends()):
    """Remove uma palavra do vocabulário."""
    return await service.delete_vocabulary_word(user['username'], term)
