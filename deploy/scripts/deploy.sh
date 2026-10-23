#!/usr/bin/env bash
# deploy.sh - Deploy eceee_v4 to production
# Usage: bash deploy/scripts/deploy.sh [TAG|HASH|REF]
#   TAG/HASH/REF: git ref to deploy (default: origin/main)
#
# Runs entirely on the production server.
# Called by: make prod-deploy (via SSH)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/env.sh
source "$SCRIPT_DIR/env.sh"
cd "$DEPLOY_DIR" || exit 1

DEPLOY_LOG="$REPO/deploy.log"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*" >&2; }

build_images_serially() {
    local service

    for service in "$@"; do
        info "Building $service image..."
        IMAGE_TAG="$IMAGE_TAG" docker_compose build "$service"
    done
}

stop_application_writers() {
    local service
    local writers=()
    for service in backend celery-worker celery-beat; do
        if grep -Fxq "$service" <<< "$COMPOSE_SERVICES"; then
            writers+=("$service")
        fi
    done
    info "Pausing application writers before schema changes..."
    docker_compose stop --timeout 30 "${writers[@]}"
}

provision_private_support_storage() {
    # This pre-migration check does not query application tables. Older releases
    # without the command remain deployable through the same control plane.
    IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python -c '
import django
django.setup()
from django.conf import settings
from django.core.management import call_command, get_commands
if getattr(settings, "SUPPORT_STORAGE_BUCKET_NAME", "") and "provision_support_storage" in get_commands():
    call_command("provision_support_storage")
'
}

resolve_release_tag() {
    # Only an exact tag describes this build; never label it with an older release.
    git -C "$1" describe --tags --exact-match --match 'v[0-9]*' "$2" 2>/dev/null || true
}

commit_installed_environment() {
    if [ -n "${ECEEE_ENV_COMMIT_MARKER:-}" ]; then
        : > "$ECEEE_ENV_COMMIT_MARKER"
        chmod 600 "$ECEEE_ENV_COMMIT_MARKER"
    fi
}

# ── 1. Pre-flight ─────────────────────────────────────────────────────────────
info "Starting deployment..."

if [ ! -f "$ENV_FILE" ]; then
    error "Missing $ENV_FILE — copy deploy/.env.production.example to deploy/.env and fill it in."
    exit 1
fi

if [ ! -d "$REPO/.git" ]; then
    error "Repo not found at $REPO — see deploy/README.md for server setup."
    exit 1
fi

bash "$SCRIPT_DIR/validate-production-env.sh" "$ENV_FILE"

acquire_production_operation_lock "deploy"

# ── 2. Determine REF ─────────────────────────────────────────────────────────
REF="${1:-}"
git -C "$REPO" fetch origin --tags --prune --quiet
if [ -z "$REF" ]; then
    REF="origin/main"
fi
TARGET_COMMIT=$(bash "$SCRIPT_DIR/validate-deploy-control-ref.sh" "$REPO" "$REF")
# Resolve short SHA for Docker image tag (slashes are invalid in image tags)
IMAGE_TAG=$(git -C "$REPO" rev-parse --short "$TARGET_COMMIT")
# Display metadata is separate from IMAGE_TAG / APP_VERSION, which remain the
# short commit identity used by cache invalidation and version-mismatch checks.
export DEPLOY_COMMIT_HASH="$TARGET_COMMIT"
export DEPLOY_RELEASE_TAG="$(resolve_release_tag "$REPO" "$TARGET_COMMIT")"
info "Deploying: $TARGET_COMMIT (image tag: $IMAGE_TAG, release: ${DEPLOY_RELEASE_TAG:-untagged})"

# ── 3. Backup ─────────────────────────────────────────────────────────────────
info "Running pre-deploy backup..."
bash "$SCRIPT_DIR/backup.sh"

# ── 4. Git pull + checkout ────────────────────────────────────────────────────
info "Checking out $TARGET_COMMIT..."
git -C "$REPO" checkout --force "$TARGET_COMMIT" --quiet
# Keep the reviewed main-branch deployment control plane in place even when the
# application/Compose target is an older rollback commit.
git -C "$REPO" checkout --no-overlay --force origin/main -- deploy/scripts/

# ── 5. Build images ───────────────────────────────────────────────────────────
info "Building images ($IMAGE_TAG)..."
BUILD_SERVICES=(backend frontend playwright)
PUBLISHER_DEPLOY_ENABLED=0
COMPOSE_SERVICES=$(IMAGE_TAG="$IMAGE_TAG" docker_compose config --services)
if grep -Fxq publisher <<< "$COMPOSE_SERVICES"; then
    BUILD_SERVICES+=(publisher)
    PUBLISHER_DEPLOY_ENABLED=1
fi
build_images_serially "${BUILD_SERVICES[@]}"

info "Checking configured private support storage before schema changes..."
provision_private_support_storage

# ── 6. Migration check ────────────────────────────────────────────────────────
info "Checking for unapplied migrations..."
# Fail on an invalid plan/connection while existing writers are still running.
IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py migrate --plan >/dev/null
if ! IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py migrate --check 2>/dev/null; then
    info "Pending migrations found; pausing writers until the new release starts."
    stop_application_writers
fi
unset COMPOSE_SERVICES

# ── 7. Apply migrations ───────────────────────────────────────────────────────
info "Running migrations..."
IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py migrate --noinput

# ── 8. Collect static files ───────────────────────────────────────────────────
info "Collecting static files..."
IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py collectstatic --noinput --clear

if [ "$PUBLISHER_DEPLOY_ENABLED" -eq 1 ]; then
    info "Provisioning least-privilege publisher database roles..."
    IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py provision_publisher_roles
    commit_installed_environment
fi

# ── 9. Start/restart containers ───────────────────────────────────────────────
commit_installed_environment
info "Stopping existing containers..."
docker_compose down --timeout 30 2>/dev/null || true
# Remove any stale containers not managed by compose (e.g. from manual runs)
while IFS= read -r stale_container; do
    if [ -n "$stale_container" ]; then
        docker rm -f "$stale_container" >/dev/null 2>&1 || true
    fi
done < <(docker ps -aq --filter "name=deploy-" 2>/dev/null)
info "Bringing up containers..."
IMAGE_TAG="$IMAGE_TAG" docker_compose up -d --remove-orphans

# ── 10. Health check ──────────────────────────────────────────────────────────
info "Waiting for health check..."
if ! bash "$SCRIPT_DIR/healthcheck.sh"; then
    error "Health check failed after deployment."
    error "Check logs with: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml --env-file \"$ENV_FILE\" logs --tail=50"
    error "To rollback:    bash $SCRIPT_DIR/rollback.sh"
    exit 1
fi

# ── 11. Cleanup old Docker artifacts ─────────────────────────────────────────
info "Pruning old images and build cache..."
docker image prune -af --filter "until=24h" 2>/dev/null || true
docker builder prune -af --filter "until=24h" 2>/dev/null || true

# ── 12. Record deployment ─────────────────────────────────────────────────────
echo "$TARGET_COMMIT ($IMAGE_TAG) $(date '+%Y-%m-%d %H:%M:%S')" >> "$DEPLOY_LOG"
success "Deployed $TARGET_COMMIT ($IMAGE_TAG) successfully."
