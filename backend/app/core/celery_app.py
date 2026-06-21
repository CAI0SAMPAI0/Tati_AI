import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

USE_CELERY = os.getenv("USE_CELERY", "false").lower() == "true"
UPSTASH_URL = os.getenv("UPSTASH_REDIS_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_TOKEN")

if USE_CELERY and UPSTASH_URL and UPSTASH_TOKEN:
    clean_url = UPSTASH_URL.replace("redis://", "").replace("https://", "").replace("http://", "")
    if ":" not in clean_url:
        clean_url = f"{clean_url}:6379"
    redis_broker_url = f"rediss://:{UPSTASH_TOKEN}@{clean_url}?ssl_cert_reqs=CERT_NONE"
else:
    redis_broker_url = "redis://localhost:6379/0"

celery_app = Celery(
    "teacher_tati_tasks",
    broker=redis_broker_url,
    backend=redis_broker_url,
    include=[
        "app.core.tasks",
        "app.modules.notifications.tasks",
        "app.modules.cefr.tasks",
        "app.modules.activities.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=2,
    broker_transport_options={
        "polling_interval": 5.0,
        "visibility_timeout": 3600,
    },
    result_expires=600,
    worker_send_task_events=False,
    task_send_sent_event=False,
)

celery_app.conf.beat_schedule = {
    "lembretes-streak-manha": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    "lembretes-streak-tarde": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=18, minute=0),
    },
    "lembretes-streak-noite": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=21, minute=30),
    },
    "limpeza-streaks-quebradas": {
        "task": "app.modules.notifications.tasks.broken_streaks",
        "schedule": crontab(hour=10, minute=0),
    },
    "checar-inatividade-alunos": {
        "task": "app.modules.notifications.tasks.check_inactivity",
        "schedule": crontab(hour="*/12", minute=0),
    },
    "relatorios-semanais-pais": {
        "task": "app.modules.notifications.tasks.weekly_reports",
        "schedule": crontab(day_of_week="sat", hour=15, minute=0),
    },
    "geracao-semanal-cefr": {
        "task": "app.modules.cefr.tasks.cefr_weekly_gen",
        "schedule": crontab(minute=0),
    },
    "keepalive-banco": {
        "task": "app.core.tasks.keepalive",
        "schedule": crontab(minute="*/30"),
    },
}
