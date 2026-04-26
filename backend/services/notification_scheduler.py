from __future__ import annotations

from core.config import settings
from services.notifications import dispatch_streak_engagement_notifications

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
except Exception:  # pragma: no cover - dependência opcional.
    AsyncIOScheduler = None

_scheduler = None


def start_notification_scheduler() -> None:
    global _scheduler

    if not settings.enable_notification_scheduler:
        print("[Notif Scheduler] Desativado por configuração")
        return

    if AsyncIOScheduler is None:
        print("[Notif Scheduler] APScheduler não instalado")
        return

    if _scheduler is not None:
        return

    scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")
    scheduler.add_job(
        dispatch_streak_engagement_notifications,
        trigger="cron",
        hour=19,
        minute=0,
        kwargs={"mode": "reminder"},
        id="streak-evening-reminder",
        replace_existing=True,
    )
    scheduler.add_job(
        dispatch_streak_engagement_notifications,
        trigger="cron",
        hour=9,
        minute=0,
        kwargs={"mode": "broken"},
        id="streak-broken-followup",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    print("[Notif Scheduler] Inicializado (19h reminder / 9h streak broken)")
