#!/bin/sh
set -e

echo ">>> [celery] Aguardando banco de dados e migrations..."
python - <<'PY'
import os
import sys
import time
import django
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError

os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "app.settings.production"))
django.setup()

deadline = time.time() + 120
while True:
    try:
        conn = connections["default"]
        conn.ensure_connection()
        if conn.vendor == "postgresql":
            with conn.cursor() as cursor:
                # Aguarda caso o servico app esteja rodando migrate neste instante
                cursor.execute("SELECT pg_advisory_lock_shared(747101)")
                cursor.execute("SELECT pg_advisory_unlock_shared(747101)")
                cursor.execute("SELECT to_regclass('public.django_celery_beat_periodictask')")
                if cursor.fetchone()[0] is None:
                    raise ProgrammingError("Tabela django_celery_beat_periodictask ainda nao criada")
        print(">>> [celery] Banco e tabelas do Celery prontos.")
        break
    except (OperationalError, ProgrammingError) as exc:
        if time.time() >= deadline:
            print(f">>> [celery] Timeout aguardando banco/migrations: {exc}", file=sys.stderr)
            sys.exit(1)
        time.sleep(3)
PY

exec "$@"
