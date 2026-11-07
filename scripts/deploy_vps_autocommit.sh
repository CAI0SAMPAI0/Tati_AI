#!/usr/bin/env bash
set -euo pipefail

echo "=== Tati AI — Auto-Deploy na VPS ==="
REPO_DIR="/home/deploy/Tati_AI"
cd "$REPO_DIR"

# 1. Garante permissão nos scripts
chmod +x scripts/*.sh backend/*.sh 2>/dev/null || true

# 2. Localiza os containers ativos do serviço app e celery
APP_CONTAINERS="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q || true)"
WORKER_CONTAINERS="$(docker ps --filter "name=tati_ai_celery_worker" --filter "status=running" -q || true)"

if [ -z "$APP_CONTAINERS" ]; then
    echo "[AVISO] Containers tati_ai_app nao encontrados rodando. Reconciliando Docker Stack..."
    ./scripts/deploy.sh --skip-build || true
    echo ">>> Forcando reescalonamento dos servicos app e celery_worker..."
    docker service update --force --replicas 2 tati_ai_app || true
    docker service update --force --replicas 1 tati_ai_celery_worker || true

    echo ">>> Aguardando os containers do tati_ai_app subirem..."
    for i in $(seq 1 24); do
        sleep 5
        APP_CONTAINERS="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q || true)"
        if [ -n "$APP_CONTAINERS" ]; then
            echo ">>> Containers tati_ai_app detectados rodando apos ${i}x5s!"
            break
        fi
    done
fi

WORKER_CONTAINERS="$(docker ps --filter "name=tati_ai_celery_worker" --filter "status=running" -q || true)"

if [ -z "$APP_CONTAINERS" ]; then
    echo ">>> [ERRO/DIAGNOSTICO] Containers do tati_ai_app ainda nao subiram. Estado do Swarm:"
    docker stack services tati_ai || true
    echo "--- docker service ps tati_ai_app ---"
    docker service ps tati_ai_app --no-trunc | head -n 15 || true
    echo "--- docker service logs tati_ai_app ---"
    docker service logs --tail 40 tati_ai_app || true
    exit 1
fi

# 3. Executa migrations pendentes dentro do primeiro container
FIRST_APP="$(echo "$APP_CONTAINERS" | head -n1)"
echo ">>> Verificando e aplicando migrations..."
docker exec "$FIRST_APP" python manage.py migrate --noinput || echo "[AVISO] Erro ao rodar migrate, continuando..."

# 4. Atualiza o código backend nos containers de produção (Zero Downtime)
for cid in $APP_CONTAINERS; do
    echo ">>> Atualizando codigo no container de aplicacao $cid..."
    docker cp "$REPO_DIR/backend/." "$cid:/app/"
    docker exec "$cid" python -m compileall /app/apps/ >/dev/null 2>&1 || true
    docker exec "$cid" kill -HUP 1 2>/dev/null || docker kill -s HUP "$cid" 2>/dev/null || true
    echo ">>> Container $cid recarregado com gunicorn HUP!"
done

# 5. Atualiza o celery worker se estiver rodando
if [ -n "$WORKER_CONTAINERS" ]; then
    for wid in $WORKER_CONTAINERS; do
        echo ">>> Atualizando codigo no worker $wid..."
        docker cp "$REPO_DIR/backend/." "$wid:/app/"
        docker exec "$wid" python -m compileall /app/apps/ >/dev/null 2>&1 || true
        echo ">>> Celery worker $wid atualizado!"
    done
fi

# 6. Teste de saude (Healthcheck)
echo ">>> Testando /health no container..."
sleep 3
HEALTH_OK=0
for _ in $(seq 1 15); do
    CURRENT_APP="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q | head -n1 || true)"
    if [ -n "$CURRENT_APP" ] && docker exec "$CURRENT_APP" curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
        echo ">>> [SUCESSO] API esta respondendo perfeitamente (Healthcheck OK)!"
        HEALTH_OK=1
        break
    fi
    sleep 3
done

if [ "$HEALTH_OK" -eq 0 ]; then
    echo ">>> [AVISO] Healthcheck interno falhou. Diagnosticando logs:"
    docker service logs --tail 30 tati_ai_app || true
fi

echo ">>> Status das tarefas Swarm:"
docker stack services tati_ai || true
docker service ps tati_ai_app --no-trunc | head -n 6 || true

echo "=== Deploy automatico finalizado com sucesso! ==="
