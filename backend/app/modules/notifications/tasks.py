from app.core.celery_app import celery_app


@celery_app.task(name="app.modules.notifications.tasks.streak_reminders")
def streak_reminders():
    import asyncio
    from app.modules.notifications.services.notification_scheduler import NotificationScheduler

    
    scheduler = NotificationScheduler()
    asyncio.run(scheduler._job_streak_reminders())