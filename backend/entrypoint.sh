#!/bin/sh
set -e

echo ">>> [app] Aguardando PostgreSQL e coordenando migrations sem bloqueio..."
python - <<'PY'
import os
import sys
import time
from urllib.parse import quote_plus
import psycopg2

host = os.getenv("POSTGRES_HOST", "db")
port = int(os.getenv("POSTGRES_PORT", "5432"))
dbname = os.getenv("POSTGRES_DB", "tati_ai")
user = os.getenv("POSTGRES_USER", "tati_user")
password = os.getenv("POSTGRES_PASSWORD", "")
db_url = os.getenv("DATABASE_URL") or (
    f"postgresql://{user}:{quote_plus(password)}@{host}:{port}/{dbname}" if host and password else ""
)

if db_url:
    deadline = time.time() + 90
    conn = None
    while True:
        try:
            conn = psycopg2.connect(db_url, connect_timeout=5)
            conn.autocommit = True
            print(">>> [app] Conexao com PostgreSQL estabelecida.")
            break
        except Exception as exc:
            if time.time() >= deadline:
                print(f">>> [app] Timeout aguardando banco: {exc}", file=sys.stderr)
                sys.exit(1)
            time.sleep(2)

    cur = conn.cursor()
    cur.execute("SELECT pg_try_advisory_lock(747101)")
    acquired = bool(cur.fetchone()[0])

    if acquired:
        try:
            print(">>> [app] Advisory lock adquirido - verificando migrate e collectstatic...")
            os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "app.settings.production"))
            import django
            from django.core.management import call_command

            django.setup()
            call_command("migrate", "--noinput")
            call_command("collectstatic", "--noinput", verbosity=0)
            print(">>> [app] Migrate e collectstatic concluidos.")
        finally:
            try:
                cur.execute("SELECT pg_advisory_unlock(747101)")
            except Exception:
                pass
            conn.close()
    else:
        print(">>> [app] Outra replica esta executando migrate - aguardando liberacao...")
        wait_deadline = time.time() + 90
        while time.time() < wait_deadline:
            time.sleep(2)
            cur.execute("SELECT pg_try_advisory_lock(747101)")
            if cur.fetchone()[0]:
                cur.execute("SELECT pg_advisory_unlock(747101)")
                break
        conn.close()
        print(">>> [app] Liberado para subir Gunicorn/Uvicorn.")
else:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "app.settings.production"))
    import django
    from django.core.management import call_command

    django.setup()
    call_command("migrate", "--noinput")
    call_command("collectstatic", "--noinput", verbosity=0)
PY

exec "$@"
