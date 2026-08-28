import os
import json
import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Any, Dict
from django.contrib.auth import get_user_model

from .models import Notification, PushSubscription
from .schemas import NotificationOut, SubscribePushInput

User = get_user_model()
logger = logging.getLogger(__name__)

WAHA_API_URL = os.getenv("WAHA_API_URL", "")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "")

def get_brevo_api_key() -> Optional[str]:
    # Checa possíveis variáveis de ambiente para a chave do Brevo
    for key_name in ["BREVO_API_KEY", "BREVO_API_KEY_TATY", "brevo_api_key", "BREVO_KEY", "brevo_smtp_key", "SMTP_PASSWORD", "smtp_password"]:
        val = os.getenv(key_name)
        if val and ("xkeysib-" in val or "xsmtpsib-" in val or len(val) > 20):
            return val.strip()
    return None


def get_verified_sender_email() -> str:
    # Brevo exige que o remetente seja um e-mail verificado na conta Brevo
    candidates = [
        os.getenv("BREVO_SENDER_EMAIL"),
        os.getenv("SMTP_FROM"),
        os.getenv("SMTP_USER"),
        os.getenv("RESEND_FROM"),
        os.getenv("login_smtp"),
        "caio.matos@11607679.brevosend.com",
        "caio.matos@aedb.br",
    ]
    for email in candidates:
        if email and isinstance(email, str):
            email_clean = email.strip()
            if email_clean and not email_clean.endswith("@smtp-brevo.com") and "smtp-brevo" not in email_clean:
                return email_clean
    return "caio.matos@11607679.brevosend.com"


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
    def mark_single_as_read(user: User, notif_id: str) -> dict:
        try:
            Notification.objects.filter(id=notif_id, username=user.username).update(is_read=True)
        except Exception:
            pass
        return {"ok": True, "message": "Notificação marcada como lida."}

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


class NotificationDispatcher:
    """
    Despachador central de notificações in-app e WebPush/FCM para o sistema operacional.
    """

    @staticmethod
    def get_vapid_keys() -> dict:
        public_key = os.getenv("VAPID_PUBLIC_KEY", "BBOj7nBpIxJXxnmGQ-sIdBbDVGOL-m7cLb6-alvr2qf3dppPl1EgWO2-As6DZpXFKGCXTl-Vq72AWi7u_k622cw")
        private_key = os.getenv("VAPID_PRIVATE_KEY", "b5TcMgeiUA9ZrM4tcTt-z-4PN-DMOXq0H1J_LR4VpX8")
        contact = os.getenv("VAPID_CONTACT", "mailto:caio.matos@aedb.br")
        return {
            "public_key": public_key,
            "private_key": private_key,
            "contact": contact,
        }

def _send_fcm_v1_admin_sdk(fcm_token: str, title: str, body: str, url: str) -> Optional[bool]:
    """
    Tenta enviar via Firebase Admin SDK (HTTP v1) usando o arquivo de credenciais JSON.
    Retorna True se enviou com sucesso, False se o token do dispositivo expirou, ou None se o JSON não foi encontrado.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
    except Exception as e:
        logger.warning(f"[FCM Admin SDK] Pacote firebase_admin não pôde ser importado: {e}")
        return None

    try:
        if not firebase_admin._apps:
            json_str = os.getenv("FIREBASE_CREDENTIALS_JSON")
            if json_str and json_str.strip().startswith("{"):
                try:
                    cred_dict = json.loads(json_str.strip())
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                except Exception as err:
                    logger.error(f"[FCM Admin SDK] Erro ao carregar FIREBASE_CREDENTIALS_JSON: {err}")

            if not firebase_admin._apps:
                root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                json_candidates = [
                    os.getenv("FIREBASE_CREDENTIALS_PATH"),
                    os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
                    "device-streaming-fc45919f-firebase-adminsdk-fbsvc-1e7b2ed04e.json",
                    os.path.join(root_dir, "device-streaming-fc45919f-firebase-adminsdk-fbsvc-1e7b2ed04e.json"),
                ]
                cred_path = None
                for p in json_candidates:
                    if p and os.path.exists(p):
                        cred_path = p
                        break

                if cred_path:
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)

            if not firebase_admin._apps:
                return None

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={"url": url, "title": title, "body": body},
            token=fcm_token,
            android=messaging.AndroidConfig(priority="high"),
        )
        response = messaging.send(message)
        logger.info(f"[FCM Admin SDK] Notificação enviada com sucesso via HTTP v1 API: {response}")
        return True
    except Exception as exc:
        logger.warning(f"[FCM Admin SDK] Erro ao enviar via Admin SDK: {exc}")
        exc_str = str(exc).lower()
        if "notregistered" in exc_str or "unregistered" in exc_str:
            return False
        return True


class NotificationDispatcher:
    """
    Despachador central de notificações in-app e WebPush/FCM para o sistema operacional.
    """

    @staticmethod
    def get_vapid_keys() -> dict:
        public_key = os.getenv("VAPID_PUBLIC_KEY", "BBOj7nBpIxJXxnmGQ-sIdBbDVGOL-m7cLb6-alvr2qf3dppPl1EgWO2-As6DZpXFKGCXTl-Vq72AWi7u_k622cw")
        private_key = os.getenv("VAPID_PRIVATE_KEY", "b5TcMgeiUA9ZrM4tcTt-z-4PN-DMOXq0H1J_LR4VpX8")
        contact = os.getenv("VAPID_CONTACT", "mailto:caio.matos@aedb.br")
        return {
            "public_key": public_key,
            "private_key": private_key,
            "contact": contact,
        }

    @staticmethod
    def send_fcm_native_push(fcm_token: str, title: str, body: str, url: str) -> bool:
        """
        Envia notificação push para o app Android nativo (Flutter APK) via Firebase Cloud Messaging.
        Suporta Firebase Admin SDK (HTTP v1 JSON) e fallback para FCM Legacy Key.
        """
        # 1. Tenta enviar via Firebase Admin SDK (Chave JSON Service Account)
        v1_result = _send_fcm_v1_admin_sdk(fcm_token, title, body, url)
        if v1_result is not None:
            return v1_result

        # 2. Fallback via Legacy HTTP API
        fcm_server_key = os.getenv("FCM_SERVER_KEY") or os.getenv("FIREBASE_SERVER_KEY")
        if not fcm_server_key:
            logger.info(f"[FCM Native] Token detectado ({fcm_token[:15]}...). (Para envio em produção, configure FCM_SERVER_KEY no .env).")
            return True

        if fcm_server_key.startswith("BBOj") or len(fcm_server_key) < 50:
            logger.warning(f"[FCM Native] FCM_SERVER_KEY no .env parece inválida (detectada chave VAPID/curta de {len(fcm_server_key)} chars). Requer FCM Legacy Server Key (AAAA...).")
            # Retorna True para não desativar o dispositivo por erro de configuração de chave no servidor
            return True

        url_endpoint = "https://fcm.googleapis.com/fcm/send"
        headers = {
            "Authorization": f"key={fcm_server_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "to": fcm_token,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default",
                "click_action": "FLUTTER_NOTIFICATION_CLICK",
            },
            "data": {
                "url": url,
                "title": title,
                "body": body,
            },
            "priority": "high",
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url_endpoint, headers=headers, json=payload)
                if res.status_code == 200:
                    logger.info(f"[FCM Native] Notificação entregue com sucesso para token {fcm_token[:15]}...")
                    return True
                else:
                    logger.warning(f"[FCM Native] Resposta FCM {res.status_code}: {res.text}")
                    # Apenas desativa token se o Firebase disser explicitamente que o token no aparelho expirou
                    if "NotRegistered" in res.text or "InvalidRegistration" in res.text:
                        return False
                    return True
        except Exception as exc:
            logger.error(f"[FCM Native] Erro de envio: {exc}")
            return True

    @staticmethod
    def send_push_to_user(username: str, title: str, body: str, url: str = "/dashboard", tag: str = "tati-notif") -> dict:
        """
        Envia push notification para todos os dispositivos ativos cadastrados do usuário (PWA, Celular, PC, APK).
        """
        try:
            from pywebpush import webpush, WebPushException
        except Exception:
            webpush = None
            WebPushException = Exception

        subs = list(PushSubscription.objects.filter(username=username, is_active=True))
        if not subs:
            return {"sent": 0, "failed": 0, "reason": "no_active_subscriptions"}

        vapid = NotificationDispatcher.get_vapid_keys()
        sent_count = 0
        failed_count = 0

        data_payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
            "icon": "/icons/icon-192x192.png",
        })

        for sub in subs:
            endpoint = (sub.endpoint or "").strip()
            # 1. Dispositivo com token FCM nativo (Flutter / Android APK)
            if endpoint.startswith("fcm:") or sub.p256dh == "fcm":
                token = endpoint.replace("fcm:", "")
                success = NotificationDispatcher.send_fcm_native_push(token, title, body, url)
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
                    # Inativa token FCM inválido/obsoleto
                    PushSubscription.objects.filter(id=sub.id).update(is_active=False)
                continue

            # 2. Navegador Web / PWA (WebPush padrão via VAPID)
            if not webpush or not vapid["private_key"]:
                failed_count += 1
                continue

            subscription_info = {
                "endpoint": endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth,
                },
            }

            try:
                webpush(
                    subscription_info=subscription_info,
                    data=data_payload,
                    vapid_private_key=vapid["private_key"],
                    vapid_claims={"sub": vapid["contact"]},
                    ttl=60 * 60 * 24, # 24 horas
                )
                sent_count += 1
            except WebPushException as exc:
                failed_count += 1
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code in (404, 410):
                    # Subscription expirada ou cancelada no navegador
                    PushSubscription.objects.filter(id=sub.id).update(is_active=False)
                    logger.info(f"[Push] Inscrição expirada removida para {username} (status {status_code})")
            except Exception as e:
                failed_count += 1
                logger.warning(f"[Push] Falha ao enviar WebPush para {username}: {e}")

        return {"sent": sent_count, "failed": failed_count}

    @staticmethod
    def notify_students_for_activity(
        activity_type: str,
        title: str,
        levels: Any,
        is_published: bool = True,
        url: str = "/activities"
    ) -> dict:
        """
        Dispara notificações para alunos estritamente pertencentes ao nível da atividade lançada.
        Regras:
        - Somente se is_published == True.
        - Se levels contiver 'ALL' ou for vazio, todos os alunos ativos serão notificados.
        - Se levels for específico (ex: ['B1']), apenas alunos com level 'B1' serão notificados.
        - Salva in-app (Notification) com o primeiro nome do aluno + envia Push Notification.
        """
        if not is_published:
            logger.info(f"[NotificationDispatcher] Atividade '{title}' está em rascunho. Notificações ignoradas.")
            return {"sent": 0, "reason": "draft_ignored"}

        # Normalização dos níveis alvo
        raw_levels = levels or ["ALL"]
        if isinstance(raw_levels, str):
            raw_levels = [l.strip().upper() for l in raw_levels.split(",") if l.strip()]
        elif isinstance(raw_levels, (list, tuple)):
            raw_levels = [str(l).strip().upper() for l in raw_levels if l]
        else:
            raw_levels = ["ALL"]

        is_all_levels = any(lvl in ["ALL", "ALL LEVELS", "*"] for lvl in raw_levels) or len(raw_levels) == 0

        # Filtra alunos ativos do nível alvo
        if is_all_levels:
            students_qs = User.objects.exclude(role__in=["admin", "teacher", "buyer"]).exclude(is_staff=True)
        else:
            students_qs = User.objects.filter(level__in=raw_levels).exclude(role__in=["admin", "teacher", "buyer"])

        # Garante que os usuários de teste (programador, caio.sampaio) sempre recebam para validação
        test_users = list(User.objects.filter(username__in=["programador", "caio.sampaio", "caio"]))
        students_dict = {u.username: u for u in list(students_qs) + test_users}
        students = list(students_dict.values())

        if not students:
            logger.info(f"[NotificationDispatcher] Nenhum aluno elegível encontrado para os níveis {raw_levels}.")
            return {"sent": 0, "count": 0}

        sent_total = 0
        whatsapp_sent = 0
        level_tag = "all levels" if is_all_levels else ", ".join(raw_levels)

        # 2 horas de janela para evitar duplicatas acidentais
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)

        for s in students:
            first_name = (s.name or s.username or "Student").strip().split()[0].capitalize()
            student_level = s.level or level_tag
            notif_title = "New Activity from Teacher Tatiana!"
            notif_body = f"Hello {first_name}! A new {activity_type} activity (\"{title}\") is now available for your level ({student_level}). Come practice!"

            try:
                # Evita criar duplicata se já existir idêntica recente
                already_exists = Notification.objects.filter(
                    username=s.username,
                    title=notif_title,
                    body=notif_body,
                    created_at__gte=two_hours_ago,
                ).exists()

                if not already_exists:
                    # 1. Salva no banco in-app (dropdown de notificações)
                    Notification.objects.create(
                        username=s.username,
                        category="new_activity",
                        title=notif_title,
                        body=notif_body,
                        is_read=False,
                    )

                # 2. Envia Push em segundo plano (tela de bloqueio / navegador)
                NotificationDispatcher.send_push_to_user(
                    username=s.username,
                    title=notif_title,
                    body=notif_body,
                    url=url,
                    tag=f"new-act-{activity_type}",
                )
                sent_total += 1

                # 3. WhatsApp (WAHA) se habilitado e o aluno tiver telefone
                student_phone = getattr(s, 'phone', None) or (s.profile or {}).get('phone') if isinstance(s.profile, dict) else None
                if send_whatsapp and student_phone:
                    wa_msg = f"*Teacher Tatiana*\n\nHello *{first_name}*! A new *{activity_type}* activity (\"{title}\") is now available for your level *{student_level}*.\n\n👉 Practice now: https://tati-ai.com{url}"
                    if WahaWhatsAppService.send_message(student_phone, wa_msg):
                        whatsapp_sent += 1

            except Exception as e:
                logger.error(f"[NotificationDispatcher] Erro ao notificar {s.username}: {e}")

        logger.info(f"[NotificationDispatcher] Notificações enviadas para {sent_total} alunos (Push/In-App) e {whatsapp_sent} (WhatsApp) no nível {raw_levels}.")
        return {"success": True, "sent": sent_total, "whatsapp_sent": whatsapp_sent, "levels": raw_levels}

    @staticmethod
    def notify_streak_risk(user: User, streak_count: int, send_whatsapp: bool = False) -> dict:
        """
        Dispara alerta de ofensiva em risco para alunos que ainda não praticaram hoje (em inglês).
        """
        first_name = (user.name or user.username or "Student").strip().split()[0].capitalize()
        title = f"Your streak is at risk, {first_name}!"
        body = f"You have a {streak_count}-day streak! Complete 1 quick exercise today to keep your streak alive."

        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
        already_exists = Notification.objects.filter(
            username=user.username,
            title=title,
            created_at__gte=two_hours_ago,
        ).exists()

        if not already_exists:
            Notification.objects.create(
                username=user.username,
                category="nudge",
                title=title,
                body=body,
                is_read=False,
            )

        push_res = NotificationDispatcher.send_push_to_user(
            username=user.username,
            title=title,
            body=body,
            url="/activities",
            tag="streak-risk",
        )

        student_phone = getattr(user, 'phone', None) or (user.profile or {}).get('phone') if isinstance(user.profile, dict) else None
        if send_whatsapp and student_phone:
            wa_msg = f"*Teacher Tatiana — Streak Alert*\n\nHello *{first_name}*! Your *{streak_count}-day study streak* is at risk today!\n\nDo a quick 3-minute exercise now to keep your streak: https://tati-ai.com/activities"
            WahaWhatsAppService.send_message(student_phone, wa_msg)

        return {"success": True, "push": push_res}


class NotificationSchedulerService:
    """
    Agendador inteligente de notificações (Streak, Relatório Semanal, Inatividade, Marcos)
    Espelha a lógica do FastAPI com suporte a Email HTML (Brevo/Resend/SMTP), Push Notification e In-App.
    """

    @staticmethod
    def send_all_test_notifications_to_user(user: User) -> dict:
        """
        Dispara todos os 6 tipos de notificação para um usuário específico (Email + Push + In-App).
        """
        first_name = (user.name or user.username or "Student").strip().split()[0].capitalize()
        email = user.email
        results = []

        # 1. Streak Reminder
        streak_val = getattr(user, 'streak', None) or 5
        title_1 = "Don't break your streak! 🔥"
        body_1 = f"Hello {first_name}! You're on a {streak_val}-day streak. Practice just 5 minutes today with Teacher Tati to keep it alive!"
        html_1 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;"><span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">🔥 STREAK AT RISK</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">Don't break your streak, {first_name}!</h1>
    <p style="color: #a79fc2; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">You have worked hard to reach a <strong style="color: #f59e0b;">{streak_val}-day study streak</strong>. Don't let your progress slip away! Just 5 minutes of practice with Teacher Tati keeps your flame burning.</p>
    <div style="text-align: center; margin: 32px 0;"><a href="https://tati-ai.vercel.app/activities" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Practice with Tati Now →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Personalized English Coaching</p>
  </div>
</body></html>"""
        diag_1 = BrevoEmailService.send_email_detailed(email, title_1, html_1, first_name) if email else {}
        push_1 = NotificationDispatcher.send_push_to_user(user.username, title_1, body_1, url="/activities", tag="streak-reminder")
        Notification.objects.create(username=user.username, category="streaks", title=title_1, body=body_1)
        results.append({"type": "streak_reminder", "email_sent": diag_1.get("success", False), "push": push_1})

        # 2. Weekly Progress Report
        from apps.users.services import ProgressReportService
        report_data = ProgressReportService.get_weekly_report(user) if hasattr(ProgressReportService, 'get_weekly_report') else {}
        mins_studied = report_data.get("total_study_minutes", 75)
        acts_done = report_data.get("activities_completed", 8)
        vocab_learned = report_data.get("vocabulary_learned", 15)
        title_2 = "📊 Your Weekly Progress Report - Teacher Tati AI"
        body_2 = f"Hello {first_name}! Your weekly report is ready: {mins_studied} min practiced, {acts_done} activities completed, and +{vocab_learned} words learned!"
        html_2 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 20px;"><span style="background: rgba(124, 58, 237, 0.15); color: #a78bfa; border: 1px solid rgba(124, 58, 237, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">📊 WEEKLY EVOLUTION REPORT</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">Great progress this week, {first_name}!</h1>
    <table style="width: 100%; border-collapse: collapse; margin: 24px 0;"><tr>
      <td style="padding: 12px; background: #221b40; border-radius: 12px 0 0 12px; text-align: center; width: 33.3%;"><div style="font-size: 22px; font-weight: 800; color: #7c3aed;">{mins_studied} min</div><div style="font-size: 12px; color: #948aa8;">Study Time</div></td>
      <td style="padding: 12px; background: #221b40; border-left: 1px solid #312759; border-right: 1px solid #312759; text-align: center; width: 33.3%;"><div style="font-size: 22px; font-weight: 800; color: #10b981;">{acts_done}</div><div style="font-size: 12px; color: #948aa8;">Activities</div></td>
      <td style="padding: 12px; background: #221b40; border-radius: 0 12px 12px 0; text-align: center; width: 33.3%;"><div style="font-size: 22px; font-weight: 800; color: #f59e0b;">+{vocab_learned}</div><div style="font-size: 12px; color: #948aa8;">Words</div></td>
    </tr></table>
    <div style="text-align: center; margin: 30px 0;"><a href="https://tati-ai.vercel.app/dashboard" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block;">View Full Report →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Real Results.</p>
  </div>
</body></html>"""
        diag_2 = BrevoEmailService.send_email_detailed(email, title_2, html_2, first_name) if email else {}
        push_2 = NotificationDispatcher.send_push_to_user(user.username, title_2, body_2, url="/dashboard", tag="weekly-report")
        Notification.objects.create(username=user.username, category="weekly_report", title=title_2, body=body_2)
        results.append({"type": "weekly_report", "email_sent": diag_2.get("success", False), "push": push_2})

        # 3. Streak Broken Comeback
        title_3 = "A fresh start awaits! 🌅"
        body_3 = f"Hello {first_name}, your streak ended, but every champion has a comeback. Today is Day 1 of your next record!"
        html_3 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 20px;"><span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">💪 TIME FOR A COMEBACK</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">Streak lost... but not you, {first_name}!</h1>
    <p style="color: #a79fc2; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">Consistency isn't about never missing a day — it's about bouncing right back. Teacher Tati is ready for your next session!</p>
    <div style="text-align: center; margin: 30px 0;"><a href="https://tati-ai.vercel.app/chat" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Start Day 1 Now →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Continuous Progress.</p>
  </div>
</body></html>"""
        diag_3 = BrevoEmailService.send_email_detailed(email, title_3, html_3, first_name) if email else {}
        push_3 = NotificationDispatcher.send_push_to_user(user.username, title_3, body_3, url="/chat", tag="streak-broken")
        Notification.objects.create(username=user.username, category="streaks", title=title_3, body=body_3)
        results.append({"type": "streak_broken", "email_sent": diag_3.get("success", False), "push": push_3})

        # 4. Streak Milestone (7 Days)
        title_4 = "🏆 7-Day Streak Achieved! You're on fire!"
        body_4 = f"Congratulations {first_name}! You've reached a 7-day study streak. You are building a powerful English habit!"
        html_4 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 20px;"><span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">🏆 MILESTONE UNLOCKED</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">7 Days in a Row, {first_name}!</h1>
    <p style="color: #a79fc2; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">One full week of consistency! You are now among the most dedicated English students. Teacher Tati is super proud!</p>
    <div style="text-align: center; margin: 30px 0;"><a href="https://tati-ai.vercel.app/achievements" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Claim Trophy & XP →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Celebrate every milestone.</p>
  </div>
</body></html>"""
        diag_4 = BrevoEmailService.send_email_detailed(email, title_4, html_4, first_name) if email else {}
        push_4 = NotificationDispatcher.send_push_to_user(user.username, title_4, body_4, url="/achievements", tag="streak-milestone")
        Notification.objects.create(username=user.username, category="achievements", title=title_4, body=body_4)
        results.append({"type": "streak_milestone", "email_sent": diag_4.get("success", False), "push": push_4})

        # 5. New Activity Released
        title_5 = "📚 New Listening Activity: 'Mastering Everyday English'"
        body_5 = f"Hi {first_name}! Teacher Tatiana just published a brand-new activity designed for your level. Check it out and boost your listening skills!"
        html_5 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 20px;"><span style="background: rgba(124, 58, 237, 0.15); color: #c084fc; border: 1px solid rgba(124, 58, 237, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">📚 NEW ACTIVITY</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">New Material from Teacher Tatiana!</h1>
    <p style="color: #a79fc2; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">A fresh exercise — <strong style="color: #ffffff;">"Mastering Everyday English"</strong> — is now open for your profile!</p>
    <div style="text-align: center; margin: 30px 0;"><a href="https://tati-ai.vercel.app/activities" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Start Activity Now →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Real-world English practice.</p>
  </div>
</body></html>"""
        diag_5 = BrevoEmailService.send_email_detailed(email, title_5, html_5, first_name) if email else {}
        push_5 = NotificationDispatcher.send_push_to_user(user.username, title_5, body_5, url="/activities", tag="new-activity")
        Notification.objects.create(username=user.username, category="new_activity", title=title_5, body=body_5)
        results.append({"type": "new_activity", "email_sent": diag_5.get("success", False), "push": push_5})

        # 6. Inactivity Nudge
        title_6 = "Tati is waiting for you! 🍎"
        body_6 = f"Hello {first_name}, it's been a few days since your last practice. Let's have a quick 3-minute conversation to keep your skills sharp!"
        html_6 = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0b1e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #18132e; border: 1px solid #3b2d6a; border-radius: 16px; overflow: hidden; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 20px;"><span style="background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px;">🍎 WE MISS YOU</span></div>
    <h1 style="color: #ffffff; font-size: 24px; text-align: center; margin: 0 0 12px 0;">Tati is waiting for you, {first_name}!</h1>
    <p style="color: #a79fc2; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">A quick 3-minute audio or text chat today will keep your English fluent and natural. Say hello to Teacher Tatiana!</p>
    <div style="text-align: center; margin: 30px 0;"><a href="https://tati-ai.vercel.app/chat" style="background: linear-gradient(135deg, #ec4899, #d946ef); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Say Hello to Tati →</a></div>
    <hr style="border: 0; border-top: 1px solid #2e2456; margin: 28px 0;" /><p style="color: #6b628a; font-size: 12px; text-align: center; margin: 0;">Teacher Tatiana AI — Always here for your learning journey.</p>
  </div>
</body></html>"""
        diag_6 = BrevoEmailService.send_email_detailed(email, title_6, html_6, first_name) if email else {}
        push_6 = NotificationDispatcher.send_push_to_user(user.username, title_6, body_6, url="/chat", tag="inactivity-nudge")
        Notification.objects.create(username=user.username, category="retention", title=title_6, body=body_6)
        results.append({"type": "inactivity_nudge", "email_sent": diag_6.get("success", False), "push": push_6})

        return {
            "success": True,
            "username": user.username,
            "email": email,
            "notifications_dispatched": results,
        }


