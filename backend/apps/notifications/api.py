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
def mark_read(request: HttpRequest):
    """
    Marca todas as notificações in-app como lidas.
    """
    return NotificationService.mark_all_as_read(request.auth)


@notifications_router.get("/vapid-key")
def get_vapid_public_key(request: HttpRequest):
    """
    Retorna a chave pública VAPID para push notifications no navegador.
    """
    import os
    vapid_key = os.getenv("VAPID_PUBLIC_KEY", "BNbJ_QkF3Y9e3p8UqX8mS4vE8a9w0yK4mO2pL3vN5")
    return {"public_key": vapid_key, "vapid_public_key": vapid_key}


# ── REGISTRO DE WEBPUSH ───────────────────────────────────────────────

@notifications_router.post("/subscribe", auth=auth_required)
@notifications_router.post("/subscribe-push", auth=auth_required)
def subscribe_push(request: HttpRequest, payload: SubscribePushInput):
    """
    Registra um token de WebPush do navegador para avisos de streak e lições.
    """
    return NotificationService.register_push_subscription(request.auth, payload)


# ── DISPARO DE E-MAIL (BREVO) ─────────────────────────────────────────

@notifications_router.post("/send-email", auth=auth_required)
def send_email(request: HttpRequest, payload: SendEmailInput):
    """
    Envia e-mail transacional via API do Brevo.
    """
    success = BrevoEmailService.send_email(
        to_email=payload.to_email,
        subject=payload.subject,
        html_content=payload.html_content,
        recipient_name=payload.recipient_name,
    )
    return {"ok": success}


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
