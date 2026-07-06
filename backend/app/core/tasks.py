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
def send_email_task(self, to_email: str, subject: str, html: str, attachments: list | None = None):
    """
    Envia e-mail via SMTP Gmail a partir do Celery worker (Amazon Linux).
    Usado pelo FastAPI no HF Space, que não consegue abrir conexões SMTP diretamente.
    Recebe: to_email, subject, html (e opcionalmente attachments).
    """
    import smtplib
    import os
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    from app.core.config import settings

    smtp_host = getattr(settings, 'smtp_host', 'smtp.gmail.com')
    smtp_port = int(getattr(settings, 'smtp_port', 465))
    smtp_user = getattr(settings, 'smtp_user', '')
    smtp_pass = getattr(settings, 'smtp_password', '')
    smtp_from = getattr(settings, 'smtp_from', '') or smtp_user

    if not (smtp_host and smtp_user and smtp_pass):
        logging.warning("[send_email_task] SMTP not configured, skipping.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Teacher Tati <{smtp_from}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        if attachments:
            for file_path in (attachments or []):
                if file_path and os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        part = MIMEApplication(f.read(), Name=os.path.basename(file_path))
                        part["Content-Disposition"] = f'attachment; filename="{os.path.basename(file_path)}"'
                        msg.attach(part)

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        logging.info(f"[send_email_task] Email sent via SMTP to {to_email}: {subject}")
        return True
    except Exception as exc:
        logging.error(f"[send_email_task] SMTP failed for {to_email}: {exc}")
        raise self.retry(exc=exc, countdown=60)