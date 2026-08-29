import os
from celery import Celery

# Define o módulo de settings padrão do Django para o 'celery'
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings.development")

app = Celery("tati_ai")

# Lê as configurações com prefixo 'CELERY_' do settings do Django
app.config_from_object("django.conf:settings", namespace="CELERY")

# Carrega tarefas assíncronas automaticamente de todos os apps Django registrados
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
