"""
Router para Gerenciamento de Notificações.
Refatorado para usar NotificationService.
"""

from fastapi import APIRouter, Depends
from app.core.exceptions import ContentNotFoundError

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
async def mark_all_read(
        user=Depends(get_current_user),
        service: NotificationService = Depends()):
    """Marca todas as notificações do usuário logado como lidas."""
    await service.mark_all_as_read(user['username'])
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


@router.post('/test-streak-reminder')
async def trigger_test_streak_reminder(
    username: str,
    streak: int = 5,
):
    """
    Envia uma notificação de teste de ofensiva (Email + Push) em inglês.
    Apenas para os usuários caio.sampaio e programador.
    """
    normalized_username = username.strip()
    if normalized_username not in ["caio.sampaio", "programador"]:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Test notifications are restricted to 'caio.sampaio' and 'programador' only."
        )

    from app.modules.notifications.services.notification_scheduler import STREAK_REMINDER_MESSAGES
    import random
    title, body_tpl = random.choice(STREAK_REMINDER_MESSAGES)
    body = body_tpl.format(streak=streak)

    from app.modules.notifications.services.notification_dispatcher import dispatch_universal_notification
    await dispatch_universal_notification(normalized_username, title, body, url="/chat")
    return {
        "success": True,
        "message": f"Test reminder notification dispatched successfully to {normalized_username}.",
        "title": title,
        "body": body
    }


from pydantic import BaseModel

class PushKeysSchema(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionSchema(BaseModel):
    endpoint: str
    keys: PushKeysSchema
    user_agent: str = ''

class PushUnsubscribeSchema(BaseModel):
    endpoint: str


@router.get('/vapid-key')
async def get_vapid_key():
    """Retorna a chave pública VAPID para registro no frontend."""
    from app.modules.notifications.services.push_notifications import get_public_vapid_key
    return {"public_key": get_public_vapid_key()}


@router.post('/subscribe')
async def subscribe_push(
    subscription: PushSubscriptionSchema,
    user=Depends(get_current_user),
):
    """Registra uma inscrição de notificação push para o usuário logado."""
    from app.modules.notifications.services.push_notifications import save_push_subscription
    success = save_push_subscription(
        username=user['username'],
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.p256dh,
        auth=subscription.keys.auth,
        user_agent=subscription.user_agent,
    )
    if not success:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Failed to save push subscription"
        )
    return {"status": "success"}


@router.post('/unsubscribe')
async def unsubscribe_push(
    subscription: PushUnsubscribeSchema,
    user=Depends(get_current_user),
):
    """Remove uma inscrição de notificação push do usuário logado."""
    from app.modules.notifications.services.push_notifications import disable_push_subscription
    disable_push_subscription(username=user['username'], endpoint=subscription.endpoint)
    return {"status": "success"}

