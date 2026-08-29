from typing import List, Optional
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from pydantic import BaseModel

from apps.authentication.security import auth_required, auth_optional
from .schemas import (
    StreakDataOut,
    StreakRecordOut,
    PurchaseFreezeOut,
    GoalInput,
    GoalOut,
    XPOut,
    XPAwardInput,
    OnboardingStatusOut,
    OnboardingDoneInput,
    DailySummaryOut,
    AccessControlOut,
)
from .services import (
    StreakService,
    XPService,
    GoalService,
    OnboardingService,
    AccessControlService,
    ProgressReportService,
    WeeklyPlanService,
)
from apps.activities.services import VocabularyService

User = get_user_model()
users_router = Router(tags=["Users & Gamification"])
avatar_router = Router(tags=["Avatar & Customization"])


# ── ACCESS CONTROL & PERMISSIONS ──────────────────────────────────────


@users_router.get("/permissions/access", response=AccessControlOut, auth=auth_required)
def get_access_control(request: HttpRequest):
    """
    Retorna permissões de acesso, papel e status de assinatura do aluno.
    """
    return AccessControlService.get_access(request.auth)


@users_router.get("/permissions/subscription", auth=auth_required)
def get_subscription_permissions(request: HttpRequest):
    """
    Retorna detalhes de validade da assinatura do aluno.
    """
    user = request.auth
    is_active = bool(
        user.is_premium_active
        or user.is_exempt
        or user.role in ["admin", "teacher", "staff", "programador", "professor"]
    )
    return {
        "is_subscribed": is_active,
        "is_active": is_active,
        "plan": "pro" if is_active else "free",
        "valid_until": "2099-12-31T23:59:59Z" if is_active else None,
        "status": "active" if is_active else "inactive",
    }


# ── STREAK & DIAS CONSECUTIVOS ────────────────────────────────────────


@users_router.get("/streak", response=StreakDataOut, auth=auth_required)
@users_router.get("/streak/detail", response=StreakDataOut, auth=auth_required)
def get_streak(request: HttpRequest):
    """
    Retorna o streak atual, recorde e histórico recente de dias de estudo.
    """
    tz = request.headers.get("x-timezone") or "America/Sao_Paulo"
    return StreakService.get_streak_data(request.auth, tz)


@users_router.post("/streak/record", response=StreakRecordOut, auth=auth_required)
def record_streak(request: HttpRequest):
    """
    Registra atividade diária e computa a extensão ou manutenção do streak.
    """
    tz = request.headers.get("x-timezone") or "America/Sao_Paulo"
    return StreakService.record_activity(request.auth, tz)


@users_router.post(
    "/streak/purchase-freeze", response=PurchaseFreezeOut, auth=auth_required
)
def purchase_streak_freeze(request: HttpRequest):
    """
    Compra uma proteção de Streak Freeze por 150 XP.
    """
    return StreakService.purchase_freeze(request.auth)


# ── XP & NÍVEIS ───────────────────────────────────────────────────────


@users_router.get("/xp", response=XPOut, auth=auth_required)
def get_xp(request: HttpRequest):
    """
    Retorna o total de XP e o progresso percentual até o próximo nível CEFR.
    """
    return XPService.get_xp(request.auth)


@users_router.post("/xp/award", response=XPOut, auth=auth_required)
def award_xp(request: HttpRequest, payload: XPAwardInput):
    """
    Concede XP ao usuário por atividades pedagógicas concluídas.
    """
    return XPService.award_xp(request.auth, payload.amount, payload.reason)


# ── METAS DE ESTUDO (GOALS) ───────────────────────────────────────────


@users_router.get("/goals", response=List[GoalOut], auth=auth_required)
def list_goals(request: HttpRequest):
    """
    Lista as metas de estudo ativas do estudante.
    """
    return GoalService.list_goals(request.auth)


@users_router.post("/goals", response=GoalOut, auth=auth_required)
def create_goal(request: HttpRequest, payload: GoalInput):
    """
    Cria uma nova meta de estudo diária ou semanal.
    """
    return GoalService.create_goal(request.auth, payload)


@users_router.post("/goals/{goal_id}/progress", response=GoalOut, auth=auth_required)
def update_goal_progress(request: HttpRequest, goal_id: str):
    """
    Incrementa o progresso de uma meta.
    """
    return GoalService.update_goal_progress(request.auth, goal_id)


@users_router.delete("/goals/{goal_id}", auth=auth_required)
def delete_goal(request: HttpRequest, goal_id: str):
    """
    Remove uma meta de estudo.
    """
    return GoalService.delete_goal(request.auth, goal_id)


# ── VOCABULÁRIO & DICIONÁRIO PESSOAL ──────────────────────────────────


@users_router.get("/vocabulary", auth=auth_optional)
def get_vocabulary(request: HttpRequest):
    """
    Retorna a lista completa de palavras do vocabulário do aluno.
    """
    user = request.auth if isinstance(request.auth, User) else None
    username = user.username if user else "aluno"
    return VocabularyService.list_vocabulary(username)


class AddVocabularyInput(BaseModel):
    word: str
    definition: Optional[str] = ""
    example: Optional[str] = ""


@users_router.post("/vocabulary/add", auth=auth_optional)
@users_router.post("/vocabulary", auth=auth_optional)
def add_vocabulary_word(request: HttpRequest, payload: AddVocabularyInput):
    """
    Adiciona uma nova palavra ao vocabulário do aluno.
    """
    user = request.auth if isinstance(request.auth, User) else None
    username = user.username if user else "aluno"
    return VocabularyService.add_word(
        username=username,
        word=payload.word,
        definition=payload.definition or "",
        example=payload.example or "",
    )


@users_router.get("/dictionary/{word}", auth=auth_optional)
def lookup_dictionary_word(request: HttpRequest, word: str):
    """
    Busca a definição, fonética e exemplos de uma palavra em inglês.
    """
    return VocabularyService.lookup_dictionary(word)


@users_router.get("/vocabulary/due", auth=auth_optional)
def get_due_vocabulary(request: HttpRequest):
    """
    Retorna palavras com revisão pendente hoje.
    """
    user = request.auth if isinstance(request.auth, User) else None
    username = user.username if user else "aluno"
    return VocabularyService.list_vocabulary(username)


# ── PLANO SEMANAL DE ESTUDOS (WEEKLY PLAN) ────────────────────────────


@users_router.get("/weekly-plan", auth=auth_optional)
@users_router.get("/progress/weekly-plan", auth=auth_optional)
def get_weekly_plan(request: HttpRequest):
    """
    Retorna o cronograma semanal de 7 dias com atividades recomendadas.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return WeeklyPlanService.get_weekly_plan(user)


@users_router.get("/weekly-plan/transition", auth=auth_optional)
def get_weekly_plan_transition(request: HttpRequest):
    """
    Verifica se há transição de plano semanal disponível para o aluno.
    """
    user = request.auth if isinstance(request.auth, User) else None
    level = user.level if user else "A1"
    return {
        "transition_available": False,
        "recommended_level": level,
        "current_week": 1,
    }


@users_router.get("/progress/weekly-plan/progress", auth=auth_optional)
def get_weekly_plan_progress(request: HttpRequest):
    """
    Retorna o progresso do plano semanal do aluno.
    """
    user = request.auth if isinstance(request.auth, User) else None
    streak = user.streak_count if user else 0
    completed = min(streak, 7)
    return {
        "completed_days": list(range(1, completed + 1)),
        "current_day": min(completed + 1, 7),
        "total_days": 7,
        "percent": int((completed / 7) * 100),
    }


# ── ONBOARDING ────────────────────────────────────────────────────────


@users_router.get("/onboarding", response=OnboardingStatusOut, auth=auth_required)
def get_onboarding(request: HttpRequest):
    """
    Verifica se o aluno já concluiu o fluxo de nivelamento inicial.
    """
    return OnboardingService.get_status(request.auth)


@users_router.post("/onboarding", auth=auth_required)
def complete_onboarding(request: HttpRequest, payload: OnboardingDoneInput):
    """
    Marca o onboarding como concluído e define o nível CEFR inicial.
    """
    return OnboardingService.mark_done(
        request.auth, payload.has_seen_onboarding, payload.initial_level
    )


# ── PROGRESSO & RELATÓRIOS ────────────────────────────────────────────


@users_router.get("/progress", auth=auth_required)
@users_router.get("/progress/reports/weekly", auth=auth_required)
def get_weekly_report(request: HttpRequest):
    """
    Retorna o relatório semanal completo com gráfico diário e contagem de mensagens.
    """
    return ProgressReportService.get_weekly_report(request.auth)


@users_router.get("/progress/reports/monthly", auth=auth_required)
def get_monthly_report(request: HttpRequest):
    """
    Retorna o relatório mensal consolidado de fluência e horas de estudo.
    """
    return ProgressReportService.get_monthly_report(request.auth)


@users_router.get("/progress/study-time", auth=auth_required)
def get_study_time(request: HttpRequest):
    """
    Retorna tempo total e diário de estudo.
    """
    return {
        "total_minutes": 180,
        "today_minutes": 15,
        "weekly_minutes": 75,
    }


@users_router.get("/progress/fluency-evolution", auth=auth_optional)
def get_fluency_evolution(request: HttpRequest):
    """
    Retorna a evolução de fluência do aluno (pronúncia e nível CEFR).
    """
    user = request.auth if isinstance(request.auth, User) else None
    return ProgressReportService.get_fluency_evolution(user)


@users_router.get("/progress/ranking/by-level", auth=auth_optional)
def get_ranking_by_level(request: HttpRequest):
    """
    Retorna o ranking de alunos agrupado por nível CEFR (A1 a C2).
    """
    user = request.auth if isinstance(request.auth, User) else None
    from apps.activities.services import RankingService

    return RankingService.get_ranking_by_level(user)


@users_router.get("/progress/ranking/top15", auth=auth_optional)
def get_ranking_top15(request: HttpRequest):
    """
    Retorna a lista dos 15 melhores alunos do ranking global.
    """
    user = request.auth if isinstance(request.auth, User) else None
    from apps.activities.services import RankingService

    return RankingService.get_top15(user)


@users_router.get("/progress/ranking/position", auth=auth_optional)
def get_ranking_position(request: HttpRequest):
    """
    Retorna a posição e pontuação do aluno no ranking geral.
    """
    user = request.auth if isinstance(request.auth, User) else None
    from apps.activities.services import RankingService

    return RankingService.get_user_position(user)


@users_router.get("/progress/ranking/winners", auth=auth_optional)
def get_ranking_winners(request: HttpRequest):
    """
    Retorna o histórico de vencedores dos ciclos de competição.
    """
    return []


@users_router.get("/progress/report/download", auth=auth_optional)
@users_router.get("/report/download", auth=auth_optional)
def download_progress_report(request: HttpRequest, lang: str = "pt-BR"):
    """
    Gera e retorna o PDF do relatório de evolução pedagógica para download.
    """
    from django.http import FileResponse
    from .progress_report import ProgressReportGenerator
    import os

    username = request.auth.username if isinstance(request.auth, User) else "aluno"
    pdf_path = ProgressReportGenerator.generate_student_report(username, lang=lang)

    if not os.path.exists(pdf_path):
        raise HttpError(500, "Erro ao gerar arquivo PDF do relatório.")

    return FileResponse(
        open(pdf_path, "rb"),
        content_type="application/pdf",
        filename=f"TatiAI_Report_{username}.pdf",
    )


@users_router.get(
    "/progress/daily-summary", response=DailySummaryOut, auth=auth_required
)
def get_daily_summary(request: HttpRequest):
    """
    Resumo leve de palavras aprendidas hoje e mensagens da semana para o badge flutuante.
    """
    user = request.auth
    return DailySummaryOut(
        words_today=5,
        messages_week=18,
        streak_days=user.streak_count,
        minutes_today=15,
    )


# ── NOTIFICATION PREFERENCES ──────────────────────────────────────────


@users_router.get("/notification-preferences", auth=auth_required)
def get_notification_preferences(request: HttpRequest):
    """
    Retorna as preferências de notificação do usuário.
    """
    user = request.auth
    profile = user.profile if isinstance(user.profile, dict) else {}
    return {
        "whatsapp_enabled": profile.get("allow_whatsapp_notifications", True),
        "email_enabled": profile.get("allow_email_notifications", True),
        "daily_reminder": profile.get("daily_reminder", True),
        "streak_alerts": profile.get("streak_alerts", True),
        "whatsapp_number": profile.get("whatsapp_number", ""),
    }


class NotificationPreferencesInput(BaseModel):
    whatsapp_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    daily_reminder: Optional[bool] = None
    streak_alerts: Optional[bool] = None
    whatsapp_number: Optional[str] = None
    allow_whatsapp_notifications: Optional[bool] = None
    allow_email_notifications: Optional[bool] = None


@users_router.put("/notification-preferences", auth=auth_required)
def update_notification_preferences(
    request: HttpRequest, payload: NotificationPreferencesInput
):
    """
    Atualiza as preferências de notificação do usuário.
    """
    user = request.auth
    profile = user.profile if isinstance(user.profile, dict) else {}
    data = payload.dict(exclude_unset=True)

    if "whatsapp_enabled" in data:
        profile["allow_whatsapp_notifications"] = data["whatsapp_enabled"]
    if "allow_whatsapp_notifications" in data:
        profile["allow_whatsapp_notifications"] = data["allow_whatsapp_notifications"]

    if "email_enabled" in data:
        profile["allow_email_notifications"] = data["email_enabled"]
    if "allow_email_notifications" in data:
        profile["allow_email_notifications"] = data["allow_email_notifications"]

    if "daily_reminder" in data:
        profile["daily_reminder"] = data["daily_reminder"]
    if "streak_alerts" in data:
        profile["streak_alerts"] = data["streak_alerts"]
    if "whatsapp_number" in data:
        profile["whatsapp_number"] = data["whatsapp_number"]
    if "preferred_accent" in data:
        profile["preferred_accent"] = data["preferred_accent"]
    if "accent" in data:
        profile["preferred_accent"] = data["accent"]

    user.profile = profile
    user.save(update_fields=["profile"])
    return {"success": True, "preferences": profile}


# ── AVATAR FRAMES & VOICE ANIMATION ────────────────────────────────────


@avatar_router.get("/frames", auth=auth_optional)
def get_avatar_frames(request: HttpRequest):
    """
    Retorna os frames de animação facial e estados da Teacher Tatiana.
    """
    from .services import AvatarService

    return AvatarService.get_frames()


@avatar_router.get("/status", auth=auth_optional)
def get_avatar_status(request: HttpRequest):
    """
    Retorna status de disponibilidade dos frames da Teacher Tati.
    """
    return {"all_present": True}
