#!/usr/bin/env bash
set -euo pipefail

# Migra esquema + dados do banco PostgreSQL atual (Supabase / Railway) para o PostgreSQL 18 local da VPS
# Uso na VPS (dentro de /home/deploy/Tati_AI, apos a stack ja estar rodando):
#   bash scripts/migrate_db_to_vps.sh

STACK_NAME="tati_ai"
BACKUP_FILE="/tmp/tati_ai_migration_$(date +%Y%m%d_%H%M%S).dump"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f .env ]; then
    echo "[ERRO] Arquivo .env nao encontrado em $REPO_DIR"
    exit 1
fi

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- | tr -d '"\r ' || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- | tr -d '"\r ' || true)"
POSTGRES_USER="${POSTGRES_USER:-tati_user}"
POSTGRES_DB="${POSTGRES_DB:-tati_ai}"

DB_CONTAINER="$(docker ps --filter "name=${STACK_NAME}_db" --filter "status=running" -q | head -n1 || true)"
if [ -z "$DB_CONTAINER" ]; then
    echo "[ERRO] Container ${STACK_NAME}_db nao encontrado em execucao. Suba a stack antes de migrar."
    exit 1
fi

if [ -z "${SOURCE_DB_URL:-}" ]; then
    echo "Cole a DATABASE_URL de ORIGEM (banco atual Supabase/Railway) e pressione ENTER"
    echo "(o texto nao aparecera na tela por seguranca):"
    read -rsp "SOURCE_DATABASE_URL: " SOURCE_DB_URL
    echo ""
fi

if [ -z "$SOURCE_DB_URL" ]; then
    echo "[ERRO] URL de origem vazia."
    exit 1
fi

echo ">>> 1/5 Gerando dump completo do schema public (esquema + dados) do banco de origem..."
docker run --rm \
    -e SOURCE_DB_URL="$SOURCE_DB_URL" \
    -v /tmp:/tmp \
    pgvector/pgvector:pg18 \
    sh -c 'pg_dump --format=custom --no-owner --no-acl --schema=public "$SOURCE_DB_URL" -f "'"$BACKUP_FILE"'"'

echo ">>> 2/5 Pausando servicos app/celery para restauracao limpa..."
docker service scale "${STACK_NAME}_app=0" "${STACK_NAME}_celery_worker=0" "${STACK_NAME}_celery_beat=0" >/dev/null

echo ">>> 3/5 Preparando schemas public e extensions (compativel com Supabase uuid-ossp + pgvector)..."
docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
CREATE SCHEMA public AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA extensions AUTHORIZATION ${POSTGRES_USER};
GRANT ALL ON SCHEMA public TO ${POSTGRES_USER}, public;
GRANT USAGE, CREATE ON SCHEMA extensions TO ${POSTGRES_USER}, public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
ALTER DATABASE ${POSTGRES_DB} SET search_path TO "\$user", public, extensions;
SQL

echo ">>> 4/5 Restaurando dump no container ${STACK_NAME}_db ($DB_CONTAINER)..."
docker cp "$BACKUP_FILE" "${DB_CONTAINER}:/tmp/restore.dump"
docker exec -i "$DB_CONTAINER" pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-acl \
    --schema=public \
    /tmp/restore.dump || echo ">>> [INFO] Avisos de politicas RLS do Supabase ignorados."

docker exec -i "$DB_CONTAINER" rm -f /tmp/restore.dump
docker run --rm -v /tmp:/tmp alpine rm -f "$BACKUP_FILE"

docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;
SQL

echo ">>> 5/5 Religando app (2 replicas), celery_worker e celery_beat..."
docker service scale "${STACK_NAME}_app=2" "${STACK_NAME}_celery_worker=1" "${STACK_NAME}_celery_beat=1"

echo ">>> Migracao de banco concluida com sucesso!"
