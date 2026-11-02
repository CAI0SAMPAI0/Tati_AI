#!/bin/sh
set -e

echo ">>> [app] Aguardando disponibilidade do PostgreSQL..."
python - <<'PY'
import os
import sys
import time
import django
from django.db import connections
from django.db.utils import OperationalError

os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "app.settings.production"))
django.setup()

deadline = time.time() + 90
while True:
    try:
        conn = connections["default"]
        conn.ensure_connection()
        print(">>> [app] Conexao com o banco estabelecida.")
        break
    except OperationalError as exc:
        if time.time() >= deadline:
            print(f">>> [app] Timeout aguardando o banco: {exc}", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
PY

echo ">>> [app] Aplicando migrations com advisory lock..."
python - <<'PY'
import os
import django
from django.core.management import call_command
from django.db import connection

os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "app.settings.production"))
django.setup()

if connection.vendor == "postgresql":
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(747101)")
        acquired = cursor.fetchone()[0]
        if acquired:
            try:
                try:
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                except Exception as ext_err:
                    print(f">>> [app] Aviso extensao vector: {ext_err}")
                print(">>> [app] Lock adquirido - executando migrate...")
                call_command("migrate", "--noinput")
            finally:
                cursor.execute("SELECT pg_advisory_unlock(747101)")
            print(">>> [app] Migrations concluidas.")
        else:
            print(">>> [app] Outra replica esta migrando - aguardando conclusao...")
            cursor.execute("SELECT pg_advisory_lock(747101)")
            cursor.execute("SELECT pg_advisory_unlock(747101)")
            print(">>> [app] Migrations concluidas pela outra replica.")
else:
    call_command("migrate", "--noinput")
PY

echo ">>> [app] Coletando arquivos estaticos..."
python manage.py collectstatic --noinput || true

exec "$@"
