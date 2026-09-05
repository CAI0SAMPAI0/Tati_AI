from typing import List, Optional
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model

from apps.authentication.security import auth_required, auth_optional
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
        "brevo_key_preview": f"{brevo_key[:8]}...{brevo_key[-4:]}"
        if brevo_key
        else None,
        "verified_sender": get_verified_sender_email(),
        "resend_configured": bool(resend_key),
        "smtp_configured": bool(smtp_host and os.getenv("SMTP_USER")),
    }


def _validate_cron_access(request: HttpRequest) -> bool:
    import os

    cron_secret = os.getenv("CRON_SECRET", "tati-ai-cron-secret-2026")
    header_secret = request.headers.get("X-Cron-Secret") or request.headers.get(
        "x-cron-secret"
    )
    auth_header = request.headers.get("Authorization", "")
    query_secret = request.GET.get("secret")

    if (
        (header_secret and header_secret == cron_secret)
        or (auth_header and f"Bearer {cron_secret}" in auth_header)
        or (query_secret and query_secret == cron_secret)
    ):
        return True

    # Se estiver autenticado como staff/admin/programador
    if (
        request.auth
        and hasattr(request.auth, "is_staff")
        and (request.auth.is_staff or getattr(request.auth, "is_programmer", False))
    ):
        return True

    return False


@notifications_router.post("/test", auth=auth_required)
@notifications_router.post("/send-all-test", auth=auth_required)
def send_test_notification(
    request: HttpRequest,
    username: Optional[str] = None,
    notification_type: str = "streak_reminder",
):
    """
    Dispara notificação de teste controlada.
    Por padrão envia apenas 1 tipo solicitado ('streak_reminder', 'weekly_report', 'inactivity_nudge', 'streak_broken', 'streak_milestone', 'new_activity' ou 'all').
    """
    from django.contrib.auth import get_user_model
    from ninja.errors import HttpError
    from .services import NotificationSchedulerService

    User = get_user_model()
    is_admin = getattr(request.auth, "is_staff", False) or getattr(
        request.auth, "is_programmer", False
    )

    if username and is_admin:
        targets = list(User.objects.filter(username=username))
    elif request.auth and hasattr(request.auth, "username"):
        targets = [request.auth]
    else:
        targets = list(User.objects.filter(username="caio.sampaio")[:1])

    if not targets:
        raise HttpError(404, "Nenhum usuário alvo encontrado para o teste.")

    all_results = {}
    for target_user in targets:
        res = NotificationSchedulerService.send_test_notification_to_user(
            target_user, notification_type=notification_type, force=True
        )
        all_results[target_user.username] = res

    return {
        "ok": True,
        "notification_type": notification_type,
        "target_users": [u.username for u in targets],
        "results": all_results,
    }


@notifications_router.post("/trigger-streak-reminders", auth=auth_required)
def trigger_streak_reminders(request: HttpRequest):
    """
    Disparo manual dos lembretes de ofensiva (Streak) para todos os alunos ativos que ainda não praticaram hoje (Horário de Brasília).
    """
    from .services import NotificationSchedulerService

    return NotificationSchedulerService.send_daily_streak_reminders_to_all_active_students()


@notifications_router.post("/trigger-weekly-reports", auth=auth_required)
def trigger_weekly_reports(request: HttpRequest):
    """
    Disparo manual dos relatórios semanais de evolução para todos os alunos ativos.
    """
    from .services import NotificationSchedulerService

    return NotificationSchedulerService.send_weekly_reports_to_all_active_students()


@notifications_router.post("/trigger-inactivity-nudges", auth=auth_required)
def trigger_inactivity_nudges(request: HttpRequest):
    """
    Disparo manual dos lembretes de inatividade (3 a 14 dias sem estudo).
    """
    from .services import NotificationSchedulerService

    return NotificationSchedulerService.send_inactivity_nudges_to_all_inactive_students()


# ── CRON WEBHOOKS SEGUROS (HORÁRIO DE BRASÍLIA / HUGGING FACE / VERCEL) ─


def _validate_cron_access(request: HttpRequest) -> bool:
    """
    Valida token secreto do cron via header (X-Cron-Token ou Authorization) ou query param ?token=.
    Também permite se o usuário logado for admin/programador/professor.
    """
    import os

    expected = (os.getenv("CRON_TOKEN") or "cai0_based").strip()
    token = (
        request.headers.get("X-Cron-Token")
        or request.GET.get("token")
        or request.headers.get("x-cron-token")
    )
    if token and token.strip() == expected:
        return True

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer_token = auth_header[7:].strip()
        if bearer_token == expected:
            return True

    user = getattr(request, "auth", None)
    if user and hasattr(user, "role") and user.role in ("programador", "admin", "professor"):
        return True

    return False


@notifications_router.post("/cron/daily-streak", auth=auth_optional)
@notifications_router.get("/cron/daily-streak", auth=auth_optional)
def cron_daily_streak(request: HttpRequest):
    """
    Webhook seguro para execução cron diária às 20:00 (Horário de Brasília).
    """
    from ninja.errors import HttpError
    from .services import NotificationSchedulerService

    if not _validate_cron_access(request):
        raise HttpError(403, "Acesso não autorizado ao webhook de cron.")

    return NotificationSchedulerService.send_daily_streak_reminders_to_all_active_students()


@notifications_router.post("/cron/weekly-reports", auth=auth_optional)
@notifications_router.get("/cron/weekly-reports", auth=auth_optional)
def cron_weekly_reports(request: HttpRequest):
    """
    Webhook seguro para execução cron semanal aos domingos às 19:00 (Horário de Brasília).
    """
    from ninja.errors import HttpError
    from .services import NotificationSchedulerService

    if not _validate_cron_access(request):
        raise HttpError(403, "Acesso não autorizado ao webhook de cron.")

    return NotificationSchedulerService.send_weekly_reports_to_all_active_students()


@notifications_router.post("/cron/inactivity-nudges", auth=auth_optional)
@notifications_router.get("/cron/inactivity-nudges", auth=auth_optional)
def cron_inactivity_nudges(request: HttpRequest):
    """
    Webhook seguro para execução cron de inatividade às 14:00 (Horário de Brasília).
    """
    from ninja.errors import HttpError
    from .services import NotificationSchedulerService

    if not _validate_cron_access(request):
        raise HttpError(403, "Acesso não autorizado ao webhook de cron.")

    return NotificationSchedulerService.send_inactivity_nudges_to_all_inactive_students()


@notifications_router.post("/cron/monthly-competition", auth=auth_optional)
@notifications_router.get("/cron/monthly-competition", auth=auth_optional)
def cron_monthly_competition(
    request: HttpRequest, year: Optional[int] = None, month: Optional[int] = None
):
    """
    Webhook seguro executado no dia 1 de cada mês às 00:05 (Horário de Brasília).
    Fecha a competição do mês anterior, calcula o Top 3 e envia relatório para o Admin por E-mail e WhatsApp.
    """
    from ninja.errors import HttpError
    from apps.activities.services import MonthlyCompetitionService

    if not _validate_cron_access(request):
        raise HttpError(403, "Acesso não autorizado ao webhook de cron.")

    return MonthlyCompetitionService.close_and_notify_admin(year=year, month=month)


@notifications_router.post("/competition/monthly-close", auth=auth_required)
def trigger_monthly_competition_close(
    request: HttpRequest, year: Optional[int] = None, month: Optional[int] = None
):
    """
    Disparo manual do fechamento mensal e envio do Top 3 para Administradores e Professora Tatiana.
    """
    from apps.activities.services import MonthlyCompetitionService

    return MonthlyCompetitionService.close_and_notify_admin(year=year, month=month)


@notifications_router.get("/competition/top3", auth=auth_optional)
def get_monthly_top3(
    request: HttpRequest, year: Optional[int] = None, month: Optional[int] = None
):
    """
    Retorna o Top 3 de um mês específico ou do mês anterior.
    """
    from apps.activities.services import MonthlyCompetitionService

    if year is None or month is None:
        year, month = MonthlyCompetitionService.get_previous_month()

    top3 = MonthlyCompetitionService.get_top3(year=year, month=month)
    return {
        "year": year,
        "month": month,
        "top3": top3,
    }


# ── DISPARO DE WHATSAPP (WAHA) ────────────────────────────────────────


@notifications_router.post("/send-whatsapp", auth=auth_required)
def send_whatsapp(request: HttpRequest, payload: SendWhatsAppInput):
    """
    Envia mensagem de texto no WhatsApp via instância WAHA.
    """
    success = WahaWhatsAppService.send_message(
        phone_number=payload.phone_number,
        message=payload.message,
        sender_user=request.auth,
    )
    return {"ok": success}

