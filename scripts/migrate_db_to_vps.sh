#!/usr/bin/env bash
set -euo pipefail

# Migra esquema + dados do banco PostgreSQL atual (Supabase / Railway) para o PostgreSQL local da VPS
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

echo "Cole a DATABASE_URL de ORIGEM (banco atual Supabase/Railway) e pressione ENTER"
echo "(o texto nao aparecera na tela por seguranca):"
read -rsp "SOURCE_DATABASE_URL: " SOURCE_DB_URL
echo ""

if [ -z "$SOURCE_DB_URL" ]; then
    echo "[ERRO] URL de origem vazia."
    exit 1
fi

echo ">>> 1/4 Gerando dump completo do schema public (esquema + dados) do banco de origem..."
docker run --rm \
    -e SOURCE_DB_URL="$SOURCE_DB_URL" \
    -v /tmp:/tmp \
    pgvector/pgvector:pg16 \
    sh -c 'pg_dump --format=custom --no-owner --no-acl --schema=public "$SOURCE_DB_URL" -f "'"$BACKUP_FILE"'"'

echo ">>> 2/4 Garantindo extensao pgvector no banco da VPS..."
docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo ">>> 3/4 Restaurando dump no container ${STACK_NAME}_db ($DB_CONTAINER)..."
docker cp "$BACKUP_FILE" "${DB_CONTAINER}:/tmp/restore.dump"
docker exec -i "$DB_CONTAINER" pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --schema=public \
    /tmp/restore.dump || echo ">>> [INFO] Avisos nao-fatais do pg_restore ignorados (normal em extensoes/objetos preexistentes)."

docker exec -i "$DB_CONTAINER" rm -f /tmp/restore.dump
rm -f "$BACKUP_FILE"

echo ">>> 4/4 Sincronizando migrations do Django e tabelas do Celery..."
APP_CONTAINER="$(docker ps --filter "name=${STACK_NAME}_app" --filter "status=running" -q | head -n1 || true)"
if [ -n "$APP_CONTAINER" ]; then
    docker exec -i "$APP_CONTAINER" python manage.py migrate --noinput
fi

echo ">>> Migracao de banco concluida com sucesso!"
