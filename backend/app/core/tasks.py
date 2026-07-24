import logging

import httpx
from app.core.celery_app import celery_app


@celery_app.task(name="app.core.tasks.keepalive")
def keepalive():
    import asyncio

    from app.core.database import keep_alive_ping

    asyncio.run(keep_alive_ping())


@celery_app.task(name="app.core.tasks.waha_keepalive")
def waha_keepalive():
    """Pings the WAHA Space to prevent it from being paused by Hugging Face inactivity policy."""
    from app.core.config import settings

    url = f"{settings.waha_api_url}/api/server/status"
    headers = {"X-Api-Key": settings.waha_api_key}
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, headers=headers)
            logging.info(f"[WAHA Keepalive] Ping to {url} -> status {res.status_code}")
    except Exception as e:
        logging.warning(f"[WAHA Keepalive] Ping failed: {e}")


@celery_app.task(name="app.core.tasks.send_email_task", bind=True, max_retries=3)
def send_email_task(
    self, to_email: str, subject: str, html: str, attachments: list | None = None
):
    """
    Envia e-mail a partir do Celery worker utilizando o EmailSender.
    Evita bloqueios de portas SMTP usando os fallbacks HTTP (Brevo/Resend).
    """
    from app.shared.services.email import EmailSender

    try:
        sender = EmailSender()
        # Executa o envio completo que tenta SMTP e depois Brevo/Resend HTTP API
        success = sender._send(to_email, subject, html, attachments)
        if not success:
            raise Exception(
                "EmailSender failed to send email via SMTP and all fallbacks."
            )
        return True
    except Exception as exc:
        logging.error(f"[send_email_task] Email sending failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
