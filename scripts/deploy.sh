#!/usr/bin/env bash
set -euo pipefail

# Deploy completo da stack Tati AI na VPS (Docker Swarm + Traefik + Python 3.12)
# Uso:
#   ./scripts/deploy.sh                # git pull + docker build + (push opcional) + stack deploy
#   ./scripts/deploy.sh --skip-build   # apenas reconcilia o docker-stack.yml

REGISTRY="ghcr.io/cai0sampai0"
IMAGE="$REGISTRY/tati_ai"
STACK_NAME="tati_ai"
STACK_FILE="docker-stack.yml"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

SKIP_BUILD=0
[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=1

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Tati AI — Deploy na VPS ($STACK_NAME) ==="

command -v docker >/dev/null 2>&1 || error "Docker nao encontrado."
docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q active \
    || error "Docker Swarm nao esta ativo neste servidor (rode: docker swarm init)."

[ -f .env ] || error "Arquivo .env nao encontrado em $REPO_DIR. Crie o .env a partir do .env.example antes de continuar."

# Carrega chaves simples do .env sem usar 'source'
while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|\#*) continue ;; esac
    [ "${line#*=}" = "$line" ] && continue
    key="${line%%=*}"; value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"; key="${key%"${key##*[![:space:]]}"}"
    case "$key" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    case "$value" in
        \"*\") value="${value#\"}"; value="${value%\"}" ;;
        \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    export "$key=$value"
done < .env

[ -n "${POSTGRES_PASSWORD:-}" ] || error "Defina POSTGRES_PASSWORD no arquivo .env antes do deploy."
[ -n "${DOMAIN:-}" ] || error "Defina DOMAIN no arquivo .env antes do deploy."
export DOMAIN

# Garante as 3 redes overlay exigidas pela stack
ensure_net() {
    local net_name="$1" extra_flag="${2:-}"
    if docker network ls --format '{{.Name}}' | grep -qx "$net_name"; then
        info "Rede $net_name OK"
    else
        # shellcheck disable=SC2086
        docker network create --driver overlay --attachable $extra_flag "$net_name" >/dev/null
        info "Rede $net_name criada"
    fi
}

ensure_net "traefik_public" ""
ensure_net "${STACK_NAME}_internal" "--internal"
ensure_net "${STACK_NAME}_egress" ""

PUSHED_GHCR=0
VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
if [ "$SKIP_BUILD" -eq 0 ]; then
    BRANCH="$(git branch --show-current 2>/dev/null || echo '')"
    if [ -n "$BRANCH" ]; then
        git pull origin "$BRANCH" || warn "git pull falhou; prosseguindo com o codigo local."
        VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
    fi

    echo "--- Construindo imagem Python 3.12 ($IMAGE:$VERSION) ---"
    docker build -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .
    info "Imagem local construida: $IMAGE:$VERSION"

    if [ -f "${HOME}/.docker/config.json" ] && grep -q 'ghcr.io' "${HOME}/.docker/config.json" 2>/dev/null; then
        echo "--- Enviando imagem ao GHCR ---"
        if docker push "$IMAGE:$VERSION" && docker push "$IMAGE:latest"; then
            PUSHED_GHCR=1
            info "Imagem enviada ao GHCR."
        else
            warn "Push para GHCR falhou; usando a imagem local neste no Swarm."
        fi
    else
        warn "Sem login no ghcr.io detectado — usando a imagem construida localmente neste no Swarm."
    fi
fi

if [ "$PUSHED_GHCR" -eq 1 ]; then
    RESOLVE_FLAG="--resolve-image=always"
    UPDATE_FLAGS=""
else
    RESOLVE_FLAG="--resolve-image=never"
    UPDATE_FLAGS="--no-resolve-image"
fi

echo "--- Aplicando stack ($STACK_FILE -> $STACK_NAME) ---"
docker stack deploy -c "$STACK_FILE" --with-registry-auth "$RESOLVE_FLAG" "$STACK_NAME"
info "Stack enviada ao Docker Swarm"

for svc in app celery_worker celery_beat; do
    # shellcheck disable=SC2086
    docker service update --force $UPDATE_FLAGS "${STACK_NAME}_${svc}" >/dev/null 2>&1 \
        && info "Rollout atualizado: ${STACK_NAME}_${svc}" || true
done

if [ -f scripts/post_deploy.sh ]; then
    bash scripts/post_deploy.sh || warn "Verifique os logs com: docker service logs -f ${STACK_NAME}_app"
fi

echo ""
echo "=== Deploy finalizado ==="
echo "  API / Healthcheck : https://${DOMAIN}/health"
echo "  Swagger Docs      : https://${DOMAIN}/docs"
echo "  Logs do Backend   : docker service logs -f ${STACK_NAME}_app"
echo "  Logs do Celery    : docker service logs -f ${STACK_NAME}_celery_worker"
echo "  Logs do Traefik   : docker service logs -f ${STACK_NAME}_traefik"
