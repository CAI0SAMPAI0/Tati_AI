from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from services.database import get_client
from services.email import send_correction_notification
from services.push_notifications import send_push_to_user

STREAK_MILESTONES = {1, 3, 7, 14, 30, 60, 100, 365}


def _is_english_lang(lang: str) -> bool:
    return str(lang or "").lower().startswith("en")


def _normalize_user_lang(lang: str | None) -> str:
    raw = str(lang or "").strip().lower()
    if raw.startswith("en-gb") or raw.startswith("en-uk"):
        return "en-UK"
    if raw.startswith("en"):
        return "en-US"
    return "pt-BR"


def _get_user_lang(username: str) -> str:
    if not username:
        return "pt-BR"
    db = get_client()
    try:
        row = (
            db.table("users")
            .select("profile")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
        if not row:
            return "pt-BR"
        profile = row[0].get("profile") or {}
        if not isinstance(profile, dict):
            return "pt-BR"
        for key in ("ui_lang", "lang", "language", "app_lang"):
            value = profile.get(key)
            if value:
                return _normalize_user_lang(str(value))
    except Exception:
        return "pt-BR"
    return "pt-BR"


def _safe_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    safe: Dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[str(key)] = value
    return safe


def _render_notification_copy(
    title: str,
    message: str,
    payload: Optional[Dict[str, Any]] = None,
    user_lang: str = "pt-BR",
) -> tuple[str, str]:
    params = _safe_payload(payload)
    streak = int(params.get("streak") or 0)
    trophy_name = str(params.get("trophy_name") or "").strip()
    is_en = _is_english_lang(user_lang)

    if title == "notif.streak_reminder.title":
        localized_title = "Do not break your streak!" if is_en else "Não quebre sua ofensiva!"
    elif title == "notif.streak_milestone.title":
        localized_title = "Streak milestone unlocked!" if is_en else "Marco de ofensiva conquistado!"
    elif title == "notif.streak_broken.title":
        localized_title = "Your streak was broken" if is_en else "Sua ofensiva foi quebrada"
    elif title == "notif.trophy_earned.title":
        localized_title = "New trophy unlocked!" if is_en else "Novo troféu desbloqueado!"
    else:
        localized_title = title

    if message == "notif.streak_reminder.message":
        localized_message = (
            f"You are on a {streak}-day streak. Practice now to keep it."
            if is_en
            else f"Você está com {streak} dias de ofensiva. Pratique agora para manter."
        )
    elif message == "notif.streak_milestone.message":
        localized_message = (
            f"You reached {streak} consecutive days. Keep the momentum."
            if is_en
            else f"Você alcançou {streak} dias seguidos. Continue nessa sequência."
        )
    elif message == "notif.streak_broken.message":
        localized_message = (
            f"Your previous streak was {streak} days. Restart today."
            if is_en
            else f"Sua ofensiva anterior foi de {streak} dias. Recomece hoje."
        )
    elif message == "notif.trophy_earned.message":
        localized_message = (
            f"You earned the trophy: {trophy_name}"
            if is_en
            else f"Você ganhou o troféu: {trophy_name}"
        )
    else:
        localized_message = message

    return localized_title, localized_message


def create_notification(
    username: str,
    type: str,
    title: str,
    message: str,
    payload: Optional[Dict[str, Any]] = None,
    send_push: bool = False,
    push_url: str = "/activities.html",
) -> None:
    """Cria notificação in-app no banco e opcionalmente envia push."""
    if not username:
        return

    db = get_client()
    safe_payload = _safe_payload(payload)

    try:
        db.table("notifications").insert(
            {
                "username": username,
                "type": type,
                "title": title,
                "message": message,
                "payload": safe_payload,
            }
        ).execute()
    except Exception:
        # Compatibilidade com bancos que ainda não têm a coluna payload.
        try:
            db.table("notifications").insert(
                {
                    "username": username,
                    "type": type,
                    "title": title,
                    "message": message,
                }
            ).execute()
        except Exception as exc:
            print(f"[Notif] Erro ao criar notificação: {exc}")
            return

    if not send_push:
        return

    user_lang = _get_user_lang(username)
    push_title, push_body = _render_notification_copy(title, message, safe_payload, user_lang)
    try:
        send_push_to_user(username, title=push_title, body=push_body, url=push_url)
    except Exception as exc:
        print(f"[Notif] Falha no push: {exc}")


def _has_notification_today(username: str, notif_type: str, now_utc: datetime) -> bool:
    db = get_client()
    start_day = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        rows = (
            db.table("notifications")
            .select("id")
            .eq("username", username)
            .eq("type", notif_type)
            .gte("created_at", start_day.isoformat())
            .limit(1)
            .execute()
            .data
        )
        return bool(rows)
    except Exception:
        return False


def should_notify_streak_milestone(previous_streak: int, new_streak: int) -> bool:
    return (
        int(new_streak or 0) in STREAK_MILESTONES
        and int(new_streak or 0) > int(previous_streak or 0)
    )


def notify_streak_milestone(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        type="streak",
        title="notif.streak_milestone.title",
        message="notif.streak_milestone.message",
        payload={"streak": int(streak_days or 0)},
        send_push=True,
        push_url="/activities.html?tab=progress",
    )


def notify_streak_reminder(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        type="streak_reminder",
        title="notif.streak_reminder.title",
        message="notif.streak_reminder.message",
        payload={"streak": int(streak_days or 0)},
        send_push=True,
        push_url="/chat.html",
    )


def notify_streak_broken(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        type="streak_broken",
        title="notif.streak_broken.title",
        message="notif.streak_broken.message",
        payload={"streak": int(streak_days or 0)},
        send_push=True,
        push_url="/chat.html",
    )


def notify_trophy_earned(username: str, trophy_name: str) -> None:
    create_notification(
        username=username,
        type="trophy",
        title="notif.trophy_earned.title",
        message="notif.trophy_earned.message",
        payload={"trophy_name": str(trophy_name or "").strip()},
        send_push=True,
        push_url="/activities.html",
    )


def notify_correction(
    username: str,
    student_name: str,
    student_email: str,
    activity_title: str,
    score: int,
    feedback: str,
) -> None:
    """Notifica correção via sino + email."""
    score_msg = "Excellent! 🎉" if score >= 90 else "Good job! 👍" if score >= 70 else "Keep practicing! 💪"

    create_notification(
        username=username,
        type="correction",
        title="Exercise corrected",
        message=f"{activity_title} · {score}/100 · {score_msg}",
    )
    send_correction_notification(student_name, student_email, activity_title, score, feedback)


def notify_welcome(username: str, name: str) -> None:
    """Notifica boas-vindas após registro."""
    create_notification(
        username=username,
        type="welcome",
        title="Welcome to Teacher Tati!",
        message=f"Hi {name}! Start chatting with Tati to practice your English.",
    )


def dispatch_streak_engagement_notifications(mode: str = "all", now_utc: Optional[datetime] = None) -> Dict[str, int]:
    """
    Dispara notificações de engajamento de streak.

    mode:
      - "all": lembrete + streak quebrada
      - "reminder": somente lembrete (não praticou hoje, mas praticou ontem)
      - "broken": somente streak quebrada (2+ dias sem prática)
    """
    summary = {"processed": 0, "reminder": 0, "broken": 0}
    ref = now_utc or datetime.now(timezone.utc)
    today = ref.date()

    db = get_client()
    try:
        users = db.table("users").select("username, streak_data").execute().data or []
    except Exception as exc:
        print(f"[Notif] Falha ao carregar usuários para job: {exc}")
        return summary

    for row in users:
        username = str(row.get("username") or "").strip()
        if not username:
            continue
        streak_data = row.get("streak_data") or {}
        if not isinstance(streak_data, dict):
            continue

        last_study_date = str(streak_data.get("last_study_date") or "").strip()
        current_streak = int(streak_data.get("current_streak") or 0)
        if not last_study_date or current_streak <= 0:
            continue

        try:
            last_date = date.fromisoformat(last_study_date)
        except Exception:
            continue

        days_since = (today - last_date).days
        summary["processed"] += 1

        if days_since == 1 and mode in {"all", "reminder"}:
            if not _has_notification_today(username, "streak_reminder", ref):
                notify_streak_reminder(username, current_streak)
                summary["reminder"] += 1
            continue

        if days_since == 2 and mode in {"all", "broken"}:
            if not _has_notification_today(username, "streak_broken", ref):
                notify_streak_broken(username, current_streak)
                summary["broken"] += 1
            continue

    return summary
