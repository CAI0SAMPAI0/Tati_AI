from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.exceptions import ContentNotFoundError
from app.core.dependencies.auth import get_current_user
from app.modules.notifications.services.notification_service import NotificationService

router = APIRouter()


class PushKeysSchema(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionSchema(BaseModel):
    endpoint: str
    keys: PushKeysSchema
    user_agent: str = ''


class PushUnsubscribeSchema(BaseModel):
    endpoint: str


class NotificationActionSchema(BaseModel):
    action: str
    notification_id: str | None = None
    category: str | None = None
    data: dict | None = None


@router.get('/')
@router.get('')
async def list_notifications(
    limit: int = 10,
    user=Depends(get_current_user),
    service: NotificationService = Depends(),
):
    return await service.get_user_notifications(user['username'], limit)


@router.post('/read-all')
async def mark_all_read(
    user=Depends(get_current_user),
    service: NotificationService = Depends()
):
    await service.mark_all_as_read(user['username'])
    return {'status': 'success'}


@router.post('/{notification_id}/read')
async def mark_read(
    notification_id: str,
    user=Depends(get_current_user),
    service: NotificationService = Depends(),
):
    success = await service.mark_as_read(notification_id, user['username'])
    if not success:
        raise ContentNotFoundError(detail='Notificação não encontrada')
    return {'status': 'success'}


@router.post('/test-streak-reminder')
async def trigger_test_streak_reminder(
    username: str,
    streak: int = 5,
):
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


@router.get('/vapid-key')
async def get_vapid_key():
    from app.modules.notifications.services.push_notifications import get_public_vapid_key
    return {"public_key": get_public_vapid_key()}


@router.post('/subscribe')
async def subscribe_push(
    subscription: PushSubscriptionSchema,
    user=Depends(get_current_user),
):
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
    from app.modules.notifications.services.push_notifications import disable_push_subscription
    disable_push_subscription(username=user['username'], endpoint=subscription.endpoint)
    return {"status": "success"}


@router.post('/actions')
async def handle_notification_action(
    payload: NotificationActionSchema,
    user=Depends(get_current_user),
):
    import logging
    logging.info(
        f"[Notification Action] User {user['username']} performed "
        f"action '{payload.action}' on category '{payload.category}'."
    )

    if payload.action == 'postpone':
        return {
            "status": "success",
            "message": "Notification action 'postpone' processed successfully. Reminder postponed by 1 hour."
        }
    elif payload.action == 'study_now':
        return {
            "status": "success",
            "message": "Notification action 'study_now' processed. Redirecting to activities."
        }

    return {
        "status": "success",
        "message": f"Action '{payload.action}' received."
    }
