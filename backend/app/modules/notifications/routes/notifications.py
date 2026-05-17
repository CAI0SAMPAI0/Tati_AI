"""
Router para Gerenciamento de Notificações.
Refatorado para usar NotificationService.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.exceptions import AuthenticationRequiredError, PremiumAccessDeniedError, ContentNotFoundError, BusinessLogicError, UserNotFoundError

from app.core.dependencies.auth import get_current_user
from app.modules.notifications.services.notification_service import NotificationService

router = APIRouter()


@router.get('/')
@router.get('')
async def list_notifications(
    limit: int = 10,
    user=Depends(get_current_user),
    service: NotificationService = Depends(),
):
    """Lista notificações do usuário logado."""
    return await service.get_user_notifications(user['username'], limit)


@router.post('/read-all')
async def mark_all_read(user=Depends(get_current_user), service: NotificationService = Depends()):
    """Marca todas as notificações do usuário logado como lidas."""
    success = await service.mark_all_as_read(user['username'])
    return {'status': 'success'}

@router.post('/{notification_id}/read')
async def mark_read(
    notification_id: str,
    user=Depends(get_current_user),
    service: NotificationService = Depends(),
):
    """Marca notificação como lida."""
    success = await service.mark_as_read(notification_id, user['username'])
    if not success:
        raise ContentNotFoundError(detail='Notificação não encontrada')
    return {'status': 'success'}
