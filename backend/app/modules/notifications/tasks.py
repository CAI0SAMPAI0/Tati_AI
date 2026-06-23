from app.core.celery_app import celery_app


@celery_app.task(name="app.modules.notifications.tasks.streak_reminders")
def streak_reminders():
    import asyncio
    from app.modules.notifications.services.notification_scheduler import NotificationScheduler

    
    scheduler = NotificationScheduler()
    asyncio.run(scheduler._job_streak_reminders())


@celery_app.task(name="app.modules.notifications.tasks.broken_streaks")
def broken_streaks():
    import asyncio
    from app.modules.notifications.services.notification_scheduler import NotificationScheduler
    scheduler = NotificationScheduler()
    asyncio.run(scheduler._job_broken_streaks())


@celery_app.task(name="app.modules.notifications.tasks.check_inactivity")
def check_inactivity():
    import asyncio
    from app.modules.notifications.services.notification_scheduler import NotificationScheduler
    scheduler = NotificationScheduler()
    asyncio.run(scheduler.check_user_inactivity())


@celery_app.task(name="app.modules.notifications.tasks.weekly_reports")
def weekly_reports():
    import asyncio
    import logging
    from app.shared.services.upstash import acquire_lock, release_lock

    async def _run():
        # Adquire lock de 1 hora para evitar duplicadas
        if not await acquire_lock("weekly_reports", expire_seconds=3600):
            logging.info("[Celery Task] Outra execução de weekly_reports já está ativa ou foi executada recentemente. Pulando.")
            return
        try:
            from app.modules.notifications.services.notification_scheduler import NotificationScheduler
            scheduler = NotificationScheduler()
            await scheduler.send_weekly_progress_reports()
        finally:
            await release_lock("weekly_reports")

    asyncio.run(_run())