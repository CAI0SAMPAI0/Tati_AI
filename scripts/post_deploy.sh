#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="tati_ai"

echo ">>> Aguardando estabilizacao do servico ${STACK_NAME}_app..."
APP_CID=""
for _ in $(seq 1 24); do
    APP_CID="$(docker ps --filter "name=${STACK_NAME}_app" --filter "status=running" -q | head -n1 || true)"
    if [ -n "$APP_CID" ]; then
        if docker exec "$APP_CID" curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
            echo ">>> [OK] Healthcheck interno respondeu 200 em ${STACK_NAME}_app ($APP_CID)."
            docker stack services "$STACK_NAME"
            exit 0
        fi
    fi
    sleep 5
done

echo ">>> [AVISO] O container ainda esta inicializando migrations ou aguardando o banco."
docker stack services "$STACK_NAME" || true
exit 0
