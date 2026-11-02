#!/usr/bin/env bash
set -euo pipefail

# Deploy sem downtime da stack Tati AI na VPS (Docker Swarm + Traefik + Python 3.12 + PostgreSQL 18)
# Garantias:
#   - Volumes externos imutaveis (tati_ai_pg_data etc.): o banco NUNCA e apagado nem reiniciado em deploys
#   - Rolling update start-first + healthcheck + rollback automatico: se a nova versao falhar, a anterior continua no ar
# Uso:
#   ./scripts/deploy.sh                # git pull + build tag imutavel + rolling deploy sem downtime
#   ./scripts/deploy.sh --skip-build   # reconcilia o docker-stack.yml usando a ultima imagem local

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

echo "=== Tati AI — Deploy Zero-Downtime na VPS ($STACK_NAME) ==="

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

# 1. Garante as 3 redes overlay exigidas pela stack
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

# 2. Garante volumes externos persistentes (protegidos contra exclusao acidental)
ensure_vol() {
    local vol_name="$1"
    if docker volume ls --format '{{.Name}}' | grep -qx "$vol_name"; then
        info "Volume persistente $vol_name preservado"
    else
        docker volume create "$vol_name" >/dev/null
        info "Volume persistente $vol_name criado"
    fi
}

ensure_vol "${STACK_NAME}_pg_data"
ensure_vol "${STACK_NAME}_media_data"
ensure_vol "${STACK_NAME}_static_data"
ensure_vol "${STACK_NAME}_letsencrypt"
ensure_vol "${STACK_NAME}_redis_data"
ensure_vol "${STACK_NAME}_waha_sessions"

PUSHED_GHCR=0
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo manual)"

if [ "$SKIP_BUILD" -eq 0 ]; then
    BRANCH="$(git branch --show-current 2>/dev/null || echo '')"
    if [ -n "$BRANCH" ]; then
        git config core.fileMode false 2>/dev/null || true
        git pull origin "$BRANCH" || warn "git pull falhou; prosseguindo com o codigo local."
        GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo manual)"
    fi

    APP_IMAGE_TAG="${GIT_SHA}_$(date +%Y%m%d%H%M%S)"
    echo "--- Construindo nova versao Python 3.12 ($IMAGE:$APP_IMAGE_TAG) sem parar a versao atual ---"
    docker build -t "$IMAGE:$APP_IMAGE_TAG" -t "$IMAGE:latest" .
    info "Imagem construida: $IMAGE:$APP_IMAGE_TAG (versao anterior mantida para rollback imediato)"

    if [ -f "${HOME}/.docker/config.json" ] && grep -q 'ghcr.io' "${HOME}/.docker/config.json" 2>/dev/null; then
        echo "--- Enviando imagem ao GHCR ---"
        if docker push "$IMAGE:$APP_IMAGE_TAG" && docker push "$IMAGE:latest"; then
            PUSHED_GHCR=1
            info "Imagem enviada ao GHCR."
        else
            warn "Push para GHCR falhou; usando a imagem local neste no Swarm."
        fi
    fi
else
    # Em --skip-build, reutiliza a tag atualmente em execucao no servico app (ou latest)
    CURRENT_IMG="$(docker service inspect "${STACK_NAME}_app" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
    if [ -n "$CURRENT_IMG" ] && [[ "$CURRENT_IMG" == *":"* ]]; then
        APP_IMAGE_TAG="${CURRENT_IMG##*:}"
        APP_IMAGE_TAG="${APP_IMAGE_TAG%%@*}"
    else
        APP_IMAGE_TAG="latest"
    fi
fi

export APP_IMAGE_TAG

if [ "$PUSHED_GHCR" -eq 1 ]; then
    RESOLVE_FLAG="--resolve-image=always"
else
    RESOLVE_FLAG="--resolve-image=never"
fi

echo "--- Aplicando rolling update ($STACK_FILE -> $STACK_NAME, tag=$APP_IMAGE_TAG) ---"
echo "    (db e redis permanecem intocados; app sobe a nova replica e testa /health antes de trocar a antiga)"
docker stack deploy -c "$STACK_FILE" --with-registry-auth "$RESOLVE_FLAG" "$STACK_NAME"
info "Stack enviada ao Docker Swarm"

if [ -f scripts/post_deploy.sh ]; then
    bash scripts/post_deploy.sh || warn "Verifique os logs com: docker service logs -f ${STACK_NAME}_app"
fi

# Limpa imagens antigas deixando sempre as 4 tags mais recentes para rollback seguro
OLD_TAGS="$(docker images "$IMAGE" --format '{{.Tag}}' | grep -v '^latest$' | grep -v '^<none>$' | tail -n +5 || true)"
if [ -n "$OLD_TAGS" ]; then
    for old_t in $OLD_TAGS; do
        docker rmi "$IMAGE:$old_t" >/dev/null 2>&1 || true
    done
fi
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "=== Deploy finalizado ==="
echo "  Versao ativa      : $IMAGE:$APP_IMAGE_TAG"
echo "  API / Healthcheck : https://${DOMAIN}/health"
echo "  Swagger Docs      : https://${DOMAIN}/docs"
echo "  Logs do Backend   : docker service logs -f ${STACK_NAME}_app"
echo "  Logs do Celery    : docker service logs -f ${STACK_NAME}_celery_worker"
echo "  Logs do WAHA      : docker service logs -f ${STACK_NAME}_waha"
