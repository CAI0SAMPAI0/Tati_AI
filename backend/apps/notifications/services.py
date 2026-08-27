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

def get_brevo_api_key() -> Optional[str]:
    # Checa possíveis variáveis de ambiente para a chave do Brevo
    for key_name in ["BREVO_API_KEY", "brevo_api_key", "BREVO_KEY", "brevo_smtp_key", "SMTP_PASSWORD"]:
        val = os.getenv(key_name)
        if val and ("xkeysib-" in val or "xsmtpsib-" in val or len(val) > 20):
            return val.strip()
    return None


def get_verified_sender_email() -> str:
    # Brevo exige que o remetente seja um e-mail verificado na conta Brevo
    return (
        os.getenv("BREVO_SENDER_EMAIL")
        or os.getenv("SMTP_FROM")
        or os.getenv("SMTP_USER")
        or os.getenv("RESEND_FROM")
        or "caio.matos@aedb.br"
    )


class BrevoEmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, html_content: str, recipient_name: str = None) -> bool:
        res = BrevoEmailService.send_email_detailed(to_email, subject, html_content, recipient_name)
        return res.get("success", False)

    @staticmethod
    def send_email_detailed(to_email: str, subject: str, html_content: str, recipient_name: str = None) -> dict:
        brevo_key = get_brevo_api_key()
        sender_email = get_verified_sender_email()
        sender_name = os.getenv("SMTP_FROM_NAME", "Teacher Tati")

        diagnostics = {
            "to_email": to_email,
            "subject": subject,
            "sender_email": sender_email,
            "brevo_key_configured": bool(brevo_key),
            "attempts": [],
        }

        # ── 1. BREVO HTTP API (Porta 443) ──────────────────────────────────
        if brevo_key:
            url = "https://api.brevo.com/v3/smtp/email"
            headers = {
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            payload = {
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": to_email, "name": recipient_name or to_email}],
                "subject": subject,
                "htmlContent": html_content,
            }

            try:
                with httpx.Client(timeout=12.0) as client:
                    res = client.post(url, headers=headers, json=payload)
                    diagnostics["attempts"].append({
                        "provider": "Brevo HTTP API",
                        "status_code": res.status_code,
                        "response": res.text,
                    })

                    if res.status_code in (200, 201, 202):
                        logger.info(f"[Brevo] E-mail enviado com sucesso para {to_email}")
                        diagnostics["success"] = True
                        diagnostics["provider"] = "Brevo"
                        return diagnostics
                    else:
                        logger.error(f"[Brevo] Erro status {res.status_code}: {res.text}. Tentando provedores alternativos...")
            except Exception as e:
                logger.error(f"[Brevo] Falha de conexão: {e}")
                diagnostics["attempts"].append({
                    "provider": "Brevo HTTP API",
                    "error": str(e),
                })
        else:
            diagnostics["attempts"].append({
                "provider": "Brevo HTTP API",
                "skipped": "Chave do Brevo não encontrada nas variáveis de ambiente.",
            })

        # ── 2. RESEND HTTP API FALLBACK (Porta 443) ────────────────────────
        resend_key = os.getenv("RESEND_API_KEY")
        if resend_key and not resend_key.startswith("xkeysib-"):
            try:
                resend_sender = os.getenv("RESEND_FROM", "Teacher Tati <onboarding@resend.dev>")
                resend_payload = {
                    "from": resend_sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                }
                resend_headers = {
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                }
                with httpx.Client(timeout=12.0) as client:
                    res = client.post("https://api.resend.com/emails", headers=resend_headers, json=resend_payload)
                    diagnostics["attempts"].append({
                        "provider": "Resend HTTP API",
                        "status_code": res.status_code,
                        "response": res.text,
                    })
                    if res.status_code in (200, 201, 202):
                        logger.info(f"[Resend] E-mail enviado com sucesso para {to_email}")
                        diagnostics["success"] = True
                        diagnostics["provider"] = "Resend"
                        return diagnostics
            except Exception as e:
                logger.error(f"[Resend] Falha de envio: {e}")
                diagnostics["attempts"].append({
                    "provider": "Resend HTTP API",
                    "error": str(e),
                })

        # ── 3. SMTP FALLBACK (Gmail / Custom SMTP) ─────────────────────────
        smtp_host = os.getenv("SMTP_HOST")
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")
        if smtp_host and smtp_user and smtp_pass:
            try:
                import smtplib
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart

                smtp_port = int(os.getenv("SMTP_PORT", "587"))
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{sender_name} <{smtp_user}>"
                msg["To"] = to_email
                msg.attach(MIMEText(html_content, "html"))

                if smtp_port == 465:
                    with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                        server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)

                logger.info(f"[SMTP] E-mail enviado com sucesso via SMTP ({smtp_host}) para {to_email}")
                diagnostics["success"] = True
                diagnostics["provider"] = "SMTP"
                diagnostics["attempts"].append({"provider": "SMTP", "status": "sent"})
                return diagnostics
            except Exception as e:
                logger.error(f"[SMTP] Falha no envio SMTP: {e}")
                diagnostics["attempts"].append({"provider": "SMTP", "error": str(e)})

        # Se nenhum provedor conseguiu enviar
        diagnostics["success"] = False
        logger.warning(f"[EmailService] Nenhum provedor de e-mail conseguiu entregar a mensagem para {to_email}.")
        return diagnostics


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
        p256dh = data.p256dh or ""
        auth = data.auth or ""
        if data.keys and isinstance(data.keys, dict):
            p256dh = data.keys.get("p256dh", p256dh)
            auth = data.keys.get("auth", auth)

        PushSubscription.objects.update_or_create(
            username=user.username,
            endpoint=data.endpoint,
            defaults={
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": data.user_agent or "",
                "is_active": True,
            },
        )
        return {"ok": True, "message": "Dispositivo cadastrado para notificações WebPush."}
