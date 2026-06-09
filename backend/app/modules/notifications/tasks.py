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
    from app.modules.notifications.services.notification_scheduler import NotificationScheduler
    scheduler = NotificationScheduler()
    asyncio.run(scheduler.send_weekly_progress_reports())