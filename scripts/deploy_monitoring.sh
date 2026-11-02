#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="tati_monitoring"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f .env ]; then
    echo "[ERRO] Arquivo .env nao encontrado em $REPO_DIR"
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DOMAIN:-}" ]; then
    echo "[ERRO] Variavel DOMAIN nao definida no .env"
    exit 1
fi

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
    echo "[ERRO] Variavel GRAFANA_ADMIN_PASSWORD nao definida no .env"
    exit 1
fi

echo "=== Tati AI — Deploy da Stack de Observabilidade (${STACK_NAME}) ==="

if ! docker network inspect tati_monitoring_net >/dev/null 2>&1; then
    docker network create --driver=overlay --attachable tati_monitoring_net >/dev/null
    echo "[OK] Rede tati_monitoring_net criada"
fi

for vol in tati_ai_prometheus_data tati_ai_grafana_data tati_ai_loki_data; do
    if ! docker volume inspect "$vol" >/dev/null 2>&1; then
        docker volume create "$vol" >/dev/null
        echo "[OK] Volume persistente $vol criado"
    else
        echo "[OK] Volume persistente $vol preservado"
    fi
done

docker stack deploy -c docker-stack.monitoring.yml "$STACK_NAME"
echo "[OK] Stack ${STACK_NAME} enviada ao Docker Swarm"
echo "     Painel Grafana: https://grafana.${DOMAIN}"
