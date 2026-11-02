#!/bin/sh
set -e

echo ">>> [celery] Aguardando PostgreSQL e tabelas do Celery..."
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
    deadline = time.time() + 120
    while True:
        try:
            conn = psycopg2.connect(db_url, connect_timeout=5)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("SELECT to_regclass('public.django_celery_beat_periodictask')")
            ready = cur.fetchone()[0] is not None
            conn.close()
            if ready:
                print(">>> [celery] Banco e tabelas do Celery prontos.")
                break
        except Exception as exc:
            if time.time() >= deadline:
                print(f">>> [celery] Timeout aguardando banco: {exc}", file=sys.stderr)
                sys.exit(1)
        if time.time() >= deadline:
            print(">>> [celery] Timeout aguardando tabelas do Celery.", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
PY

exec "$@"
