import os
from celery import Celery
from celery.schedules import crontab

# Recupera as credenciais do Upstash Redis configuradas no Railway
UPSTASH_URL = os.getenv('UPSTASH_REDIS_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_REDIS_TOKEN')

# Formata a URL para o padrão redis://:token@host:port
# Removendo o prefixo http/https caso venha no formato REST do Upstash
if UPSTASH_URL:
    clean_url = UPSTASH_URL.replace("redis://", "").replace("https://", "").replace("http://", "")
    redis_broker_url = f"redis://:{UPSTASH_TOKEN}@{clean_url}"
else:
    # Fallback para desenvolvimento local
    redis_broker_url = "redis://localhost:6379/0"

# Inicializa o Celery apontando para os modulos de tarefas
celery_app = Celery(
    "teacher_tati_tasks",
    broker=redis_broker_url,
    backend=redis_broker_url
)

# Configuracoes de performance e otimizacao para o Upstash (Fila Leve)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    # Evita que um worker trave pegando muitas tarefas pesadas de uma vez
    worker_prefetch_multiplier=1,
)

# Migracao do APScheduler para o Celery Beat (Cron Jobs)
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
        "schedule": crontab(hour="*/12", minute=0),  # A cada 12 horas
    },
    "relatorios-semanais-pais": {
        "task": "app.modules.notifications.tasks.weekly_reports",
        "schedule": crontab(day_of_week="sat", hour=15, minute=0),
    },
    "geracao-semanal-cefr": {
        "task": "app.modules.cefr.tasks.cefr_weekly_gen",
        "schedule": crontab(day_of_week="mon", hour=3, minute=0),
    },
    "keepalive-banco": {
        "task": "app.core.tasks.keepalive",
        "schedule": crontab(minute="*/4"),
    },
}
