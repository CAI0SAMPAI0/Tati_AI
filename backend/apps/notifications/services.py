import os
import logging
import httpx
from typing import List, Optional
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from .models import Notification, PushSubscription
from .schemas import NotificationOut, SubscribePushInput

User = get_user_model()
logger = logging.getLogger(__name__)

BREVO_API_KEY = os.getenv("BREVO_API_KEY") or os.getenv("brevo_smtp_key")
WAHA_API_URL = os.getenv("WAHA_API_URL", "https://waha-noweb-tati-ai.onrender.com")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "")


class BrevoEmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, html_content: str, recipient_name: str = None) -> bool:
        if not BREVO_API_KEY:
            logger.warning(f"[Brevo] BREVO_API_KEY não configurada. Simulando envio para {to_email}: {subject}")
            return True

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "sender": {"name": "Teacher Tati", "email": os.getenv("SMTP_FROM", "contato@tati-ai.com")},
            "to": [{"email": to_email, "name": recipient_name or to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }

        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code in (200, 201, 202):
                    logger.info(f"[Brevo] E-mail enviado com sucesso para {to_email}")
                    return True
                else:
                    logger.error(f"[Brevo] Erro status {res.status_code}: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"[Brevo] Falha ao enviar e-mail: {e}")
            return False


class WahaWhatsAppService:
    @staticmethod
    def send_message(phone_number: str, message: str) -> bool:
        if not WAHA_API_URL or not WAHA_API_KEY:
            logger.warning(f"[WAHA] WAHA_API_URL/KEY não configuradas. Mensagem para {phone_number}: {message}")
            return True

        clean_number = "".join(c for c in phone_number if c.isdigit())
        if not clean_number.endswith("@c.us"):
            chat_id = f"{clean_number}@c.us"
        else:
            chat_id = clean_number

        url = f"{WAHA_API_URL.rstrip('/')}/api/sendText"
        headers = {
            "X-Api-Key": WAHA_API_KEY,
            "Content-Type": "application/json",
        }
        payload = {
            "session": "default",
            "chatId": chat_id,
            "text": message,
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code in (200, 201):
                    logger.info(f"[WAHA] WhatsApp enviado com sucesso para {clean_number}")
                    return True
                else:
                    logger.warning(f"[WAHA] Resposta {res.status_code}: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"[WAHA] Erro de comunicação com o WhatsApp: {e}")
            return False


class NotificationService:
    @staticmethod
    def list_notifications(user: User) -> List[NotificationOut]:
        notes = Notification.objects.filter(username=user.username)[:30]
        return [
            NotificationOut(
                id=n.id,
                category=n.category,
                title=n.title,
                body=n.body,
                is_read=n.is_read,
                created_at=n.created_at.isoformat() if n.created_at else None,
            )
            for n in notes
        ]

    @staticmethod
    def mark_all_as_read(user: User) -> dict:
        Notification.objects.filter(username=user.username, is_read=False).update(is_read=True)
        return {"ok": True, "message": "Todas as notificações foram marcadas como lidas."}

    @staticmethod
    def register_push_subscription(user: User, data: SubscribePushInput) -> dict:
        PushSubscription.objects.update_or_create(
            username=user.username,
            endpoint=data.endpoint,
            defaults={
                "p256dh": data.p256dh,
                "auth": data.auth,
                "user_agent": data.user_agent or "",
                "is_active": True,
            },
        )
        return {"ok": True, "message": "Dispositivo cadastrado para notificações WebPush."}
