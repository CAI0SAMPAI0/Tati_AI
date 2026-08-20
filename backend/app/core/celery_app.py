import os

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv
from celery.signals import after_setup_logger, after_setup_task_logger


load_dotenv()

USE_CELERY = os.getenv("USE_CELERY", "false").lower() == "true"


# Função auxiliar para gerar dinamicamente as URLs do broker e backend
def get_celery_configurations():
    # Força recarregamento do dotenv
    load_dotenv(override=True)

    amqp_url = os.getenv("CLOUD_AMQP_URL")
    upstash_url = os.getenv("UPSTASH_REDIS_URL")
    upstash_token = os.getenv("UPSTASH_REDIS_TOKEN")

    redis_backend_url = None
    if upstash_url and upstash_token:
        clean_url = (
            upstash_url.replace("redis://", "")
            .replace("https://", "")
            .replace("http://", "")
        )
        if ":" not in clean_url:
            clean_url = f"{clean_url}:6379"
        redis_backend_url = (
            f"rediss://:{upstash_token}@{clean_url}?ssl_cert_reqs=CERT_NONE"
        )

    if amqp_url:
        broker_url = amqp_url
    elif redis_backend_url:
        broker_url = redis_backend_url
    else:
        broker_url = "redis://localhost:6379/0"

    if redis_backend_url:
        backend_url = redis_backend_url
    elif amqp_url:
        backend_url = "rpc://"
    else:
        backend_url = "redis://localhost:6379/0"

    return broker_url, backend_url


# Obtém dinamicamente
broker_url, backend_url = get_celery_configurations()

celery_app = Celery(
    "teacher_tati_tasks",
    broker=broker_url,
    backend=backend_url,
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
        "visibility_timeout": 7200,
    },
    result_expires=600,
    worker_send_task_events=False,
    task_send_sent_event=False,
    task_time_limit=1800,
    task_soft_time_limit=1500,
    beat_max_loop_interval=300,
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
    # Pinga a Render a cada 10 minutos para evitar hibernação (free tier dorme após 15min sem tráfego)
    "keepalive-waha": {
        "task": "app.core.tasks.waha_keepalive",
        "schedule": crontab(minute="*/10"),
    },
}


@after_setup_logger.connect
def setup_loggers(logger, *args, **kwargs):
    import logging

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


@after_setup_task_logger.connect
def setup_task_loggers(logger, *args, **kwargs):
    import logging

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
