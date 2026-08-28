from typing import List
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model

from apps.authentication.security import auth_required
from .schemas import (
    NotificationOut,
    SubscribePushInput,
    SendEmailInput,
    SendWhatsAppInput,
)
from .services import NotificationService, BrevoEmailService, WahaWhatsAppService

User = get_user_model()
notifications_router = Router(tags=["Notifications"])


# ── NOTIFICAÇÕES IN-APP ───────────────────────────────────────────────

@notifications_router.get("", response=List[NotificationOut], auth=auth_required)
def list_notifications(request: HttpRequest):
    """
    Retorna a lista de notificações in-app recebidas pelo aluno.
    """
    return NotificationService.list_notifications(request.auth)


@notifications_router.post("/read-all", auth=auth_required)
def mark_read_all(request: HttpRequest):
    """
    Marca todas as notificações in-app como lidas.
    """
    return NotificationService.mark_all_as_read(request.auth)


@notifications_router.post("/{notification_id}/read", auth=auth_required)
@notifications_router.post("/read/{notification_id}", auth=auth_required)
def mark_single_read(request: HttpRequest, notification_id: str):
    """
    Marca uma notificação individual como lida.
    """
    return NotificationService.mark_single_as_read(request.auth, notification_id)


@notifications_router.get("/vapid-key")
def get_vapid_public_key(request: HttpRequest):
    """
    Retorna a chave pública VAPID para push notifications no navegador.
    """
    from .services import NotificationDispatcher
    vapid = NotificationDispatcher.get_vapid_keys()
    return {"public_key": vapid["public_key"], "vapid_public_key": vapid["public_key"]}


# ── REGISTRO DE WEBPUSH ───────────────────────────────────────────────

@notifications_router.post("/subscribe", auth=auth_required)
@notifications_router.post("/subscribe-push", auth=auth_required)
def subscribe_push(request: HttpRequest, payload: SubscribePushInput):
    """
    Registra um token de WebPush do navegador para avisos de streak e lições.
    """
    return NotificationService.register_push_subscription(request.auth, payload)


# ── DISPARO DE NOTIFICAÇÃO MANUAL / TESTE (POR NÍVEL OU GLOBAL) ──────

@notifications_router.post("/broadcast", auth=auth_required)
def broadcast_notification(request: HttpRequest, payload: dict):
    """
    Permite à professora ou administrador enviar uma notificação personalizada para alunos de um nível ou todos.
    Ex: payload = {"title": "Título", "activity_type": "Grammar", "levels": ["B1"], "is_published": True}
    """
    from .services import NotificationDispatcher
    activity_type = payload.get("activity_type", "Atividade")
    title = payload.get("title", "Nova Lição")
    levels = payload.get("levels", ["ALL"])
    is_pub = payload.get("is_published", True)
    url = payload.get("url", "/activities")

    return NotificationDispatcher.notify_students_for_activity(
        activity_type=activity_type,
        title=title,
        levels=levels,
        is_published=is_pub,
        url=url,
    )



# ── DISPARO DE E-MAIL (BREVO & MULTI-PROVIDER) ───────────────────────

@notifications_router.post("/send-email", auth=auth_required)
def send_email(request: HttpRequest, payload: SendEmailInput):
    """
    Envia e-mail transacional via API do Brevo com fallbacks automáticos.
    """
    diag = BrevoEmailService.send_email_detailed(
        to_email=payload.to_email,
        subject=payload.subject,
        html_content=payload.html_content,
        recipient_name=payload.recipient_name,
    )
    return {"ok": diag.get("success", False), "details": diag}


@notifications_router.get("/email-status", auth=auth_required)
def get_email_status(request: HttpRequest):
    """
    Retorna o status de configuração dos provedores de e-mail (Brevo, Resend, SMTP).
    """
    from .services import get_brevo_api_key, get_verified_sender_email
    brevo_key = get_brevo_api_key()
    resend_key = os.getenv("RESEND_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")

    return {
        "brevo_configured": bool(brevo_key),
        "brevo_key_preview": f"{brevo_key[:8]}...{brevo_key[-4:]}" if brevo_key else None,
        "verified_sender": get_verified_sender_email(),
        "resend_configured": bool(resend_key),
        "smtp_configured": bool(smtp_host and os.getenv("SMTP_USER")),
    }


@notifications_router.post("/send-all-test", auth=auth_required)
def send_all_test_notifications(request: HttpRequest):
    """
    Dispara todas as 6 notificações do sistema (Email, Push e In-App) para o usuário autenticado.
    """
    from .services import NotificationSchedulerService
    return NotificationSchedulerService.send_all_test_notifications_to_user(request.auth)



# ── DISPARO DE WHATSAPP (WAHA) ────────────────────────────────────────

@notifications_router.post("/send-whatsapp", auth=auth_required)
def send_whatsapp(request: HttpRequest, payload: SendWhatsAppInput):
    """
    Envia mensagem de texto no WhatsApp via instância WAHA.
    """
    success = WahaWhatsAppService.send_message(
        phone_number=payload.phone_number,
        message=payload.message,
    )
    return {"ok": success}
