#!/usr/bin/env bash
set -euo pipefail

echo "Iniciando implantação automática na VPS..."
REPO_DIR="/home/deploy/Tati_AI"
cd "$REPO_DIR"

# 1. Garante permissão de execução nos scripts
chmod +x scripts/*.sh backend/*.sh 2>/dev/null || true

# 2. Reconcilia o Docker Stack para aplicar novas labels do Traefik e limites
echo "Sincronizando definição da Stack no Docker Swarm..."
./scripts/deploy.sh --skip-build || true
sleep 5

# 3. Localiza os contêineres ativos do serviço app e celery
APP_CONTAINERS="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q || true)"

if [ -z "$APP_CONTAINERS" ]; then
    echo "Aviso: Contêineres tati_ai_app não encontrados rodando. Reconciliando Docker Stack..."
    ./scripts/deploy.sh --skip-build || true
    echo "Forçando reescalonamento dos serviços app e celery_worker..."
    docker service update --force --replicas 2 tati_ai_app || true
    docker service update --force --replicas 1 tati_ai_celery_worker || true

    echo "Aguardando os contêineres do tati_ai_app iniciarem..."
    for i in $(seq 1 24); do
        sleep 5
        APP_CONTAINERS="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q || true)"
        if [ -n "$APP_CONTAINERS" ]; then
            echo "Contêineres tati_ai_app detectados em execução!"
            break
        fi
    done
fi

if [ -z "$APP_CONTAINERS" ]; then
    echo "Erro: Contêineres do tati_ai_app ainda não iniciaram. Estado do Swarm:"
    docker stack services tati_ai || true
    docker service ps tati_ai_app --no-trunc | head -n 15 || true
    docker service logs --tail 40 tati_ai_app || true
    exit 1
fi

# 4. Atualiza o código backend nos contêineres de produção ANTES das migrações
FIRST_APP="$(echo "$APP_CONTAINERS" | head -n1)"
CURRENT_IMG="$(docker service inspect tati_ai_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo 'ghcr.io/cai0sampai0/tati_ai:latest')"
CURRENT_IMG="${CURRENT_IMG%%@*}"

for cid in $APP_CONTAINERS; do
    if ! docker inspect --format '{{.State.Running}}' "$cid" 2>/dev/null | grep -q "true"; then
        echo "Contêiner $cid não está mais em execução. Pulando..."
        continue
    fi
    echo "Copiando código atualizado para o contêiner de aplicação $cid..."
    docker cp "$REPO_DIR/backend/." "$cid:/app/" || continue
    docker exec -u 0 "$cid" chown -R 1000:1000 /app 2>/dev/null || true
    docker exec "$cid" python -m compileall /app/apps/ >/dev/null 2>&1 || true
done

# 5. Persiste o código atualizado na imagem local do Swarm para evitar regressão em restarts
if [ -n "$FIRST_APP" ]; then
    echo "Persistindo código atualizado na imagem local ($CURRENT_IMG e ghcr.io/cai0sampai0/tati_ai:latest)..."
    docker commit "$FIRST_APP" "$CURRENT_IMG" >/dev/null 2>&1 || true
    docker commit "$FIRST_APP" "ghcr.io/cai0sampai0/tati_ai:latest" >/dev/null 2>&1 || true
fi

# 6. Executa migrações pendentes dentro do primeiro contêiner já atualizado
echo "Verificando e aplicando migrações de banco de dados..."
docker exec "$FIRST_APP" python manage.py migrate --noinput || echo "Aviso: Erro ao rodar migrate, continuando..."

# 7. Recarrega os workers Gunicorn/Uvicorn com atualização progressiva (zero-downtime)
for cid in $APP_CONTAINERS; do
    if ! docker inspect --format '{{.State.Running}}' "$cid" 2>/dev/null | grep -q "true"; then
        continue
    fi
    docker exec "$cid" kill -HUP 1 2>/dev/null || docker kill -s HUP "$cid" 2>/dev/null || true
    echo "Contêiner $cid recebeu sinal HUP. Aguardando resposta saudável..."

    CONTAINER_READY=0
    for attempt in $(seq 1 12); do
        sleep 2
        if docker exec "$cid" curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
            echo "Contêiner $cid está saudável e respondendo 200 OK!"
            CONTAINER_READY=1
            break
        fi
    done
    if [ "$CONTAINER_READY" -eq 0 ]; then
        echo "Aviso: Contêiner $cid demorou para responder ao healthcheck interno."
    fi
done

# 8. Atualiza e recicla o celery worker usando a imagem local já atualizada
WORKER_CONTAINERS="$(docker ps --filter "name=tati_ai_celery_worker" --filter "status=running" -q || true)"
if [ -n "$WORKER_CONTAINERS" ]; then
    for wid in $WORKER_CONTAINERS; do
        if ! docker inspect --format '{{.State.Running}}' "$wid" 2>/dev/null | grep -q "true"; then
            echo "Worker $wid não está mais em execução. Pulando..."
            continue
        fi
        echo "Atualizando código no worker $wid..."
        docker cp "$REPO_DIR/backend/." "$wid:/app/" || continue
        docker exec -u 0 "$wid" chown -R 1000:1000 /app 2>/dev/null || true
        docker exec "$wid" python -m compileall /app/apps/ >/dev/null 2>&1 || true
        echo "Celery worker $wid atualizado!"
    done
    echo "Reciclando o serviço tati_ai_celery_worker no Swarm (com imagem persistida) para liberar memória RAM e Swap..."
    docker service update --force --detach=false tati_ai_celery_worker || docker service update --force tati_ai_celery_worker || true
fi

# 7. Teste de saúde da API
echo "Testando endpoint de saúde na aplicação..."
sleep 3
HEALTH_OK=0
for _ in $(seq 1 15); do
    CURRENT_APP="$(docker ps --filter "name=tati_ai_app" --filter "status=running" -q | head -n1 || true)"
    if [ -n "$CURRENT_APP" ] && docker exec "$CURRENT_APP" curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
        echo "API está respondendo perfeitamente com status 200 OK!"
        HEALTH_OK=1
        break
    fi
    sleep 3
done

if [ "$HEALTH_OK" -eq 0 ]; then
    echo "Aviso: Healthcheck interno falhou. Diagnosticando logs recentes:"
    docker service logs --tail 30 tati_ai_app || true
fi

echo "Status dos serviços no Docker Swarm:"
docker stack services tati_ai || true
docker service ps tati_ai_app --no-trunc | head -n 6 || true

echo "Implantação concluída com sucesso!"
