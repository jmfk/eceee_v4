#!/usr/bin/env bash
# deploy.sh - Deploy eceee_v4 to production
# Usage: bash deploy/scripts/deploy.sh [TAG|BRANCH]
#   TAG/BRANCH: git ref to deploy (default: origin/main)
#
# Runs entirely on the production server.
# Called by: make prod-deploy (via SSH)

set -euo pipefail

REPO=$(pwd)
ENV_FILE="$REPO/.env"
COMPOSE_FILE="$REPO/deploy/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
DEPLOY_LOG="$REPO/deploy.log"
SCRIPT_DIR="$REPO/deploy/scripts"

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

# ── 1. Pre-flight ─────────────────────────────────────────────────────────────
info "Starting deployment..."

if [ ! -f "$ENV_FILE" ]; then
    error "Missing $ENV_FILE — copy deploy/env.production.example to /opt/eceee/.env and fill it in."
    exit 1
fi

if [ ! -d "$REPO/.git" ]; then
    error "Repo not found at $REPO — see deploy/README.md for server setup."
    exit 1
fi

# ── 2. Determine REF ─────────────────────────────────────────────────────────
TAG="${1:-}"
if [ -z "$TAG" ]; then
    git -C "$REPO" fetch origin --quiet
    TAG="origin/main"
fi
info "Deploying: $TAG"

# ── 3. Backup ─────────────────────────────────────────────────────────────────
info "Running pre-deploy backup..."
bash "$SCRIPT_DIR/backup.sh" || {
    warn "Backup failed — continuing anyway. Check /mnt/data/backups/ manually."
}

# ── 4. Git pull + checkout ────────────────────────────────────────────────────
info "Checking out $TAG..."
git -C "$REPO" checkout --force "$TAG" --quiet

# ── 5. Build images ───────────────────────────────────────────────────────────
info "Building images for tag $TAG..."
IMAGE_TAG="$TAG" $COMPOSE build backend frontend playwright

# ── 6. Migration check ────────────────────────────────────────────────────────
info "Checking for unapplied migrations..."
# --check exits with code 1 if there are pending migrations
if ! IMAGE_TAG="$TAG" $COMPOSE run --rm backend python manage.py migrate --check 2>/dev/null; then
    info "Pending migrations found — will apply after health check of current instance."
fi

# ── 7. Apply migrations ───────────────────────────────────────────────────────
info "Running migrations..."
IMAGE_TAG="$TAG" $COMPOSE run --rm backend python manage.py migrate --noinput

# ── 8. Collect static files ───────────────────────────────────────────────────
info "Collecting static files..."
IMAGE_TAG="$TAG" $COMPOSE run --rm backend python manage.py collectstatic --noinput --clear

# ── 9. Start/restart containers ───────────────────────────────────────────────
info "Stopping existing containers..."
$COMPOSE down --timeout 30 2>/dev/null || true
# Remove any stale containers not managed by compose (e.g. from manual runs)
docker rm -f $(docker ps -aq --filter "name=deploy-" 2>/dev/null) 2>/dev/null || true
info "Bringing up containers..."
IMAGE_TAG="$TAG" $COMPOSE up -d --remove-orphans

# ── 10. Health check ──────────────────────────────────────────────────────────
info "Waiting for health check..."
if ! bash "$SCRIPT_DIR/healthcheck.sh"; then
    error "Health check failed after deployment."
    error "Check logs with: docker compose -f $COMPOSE_FILE logs --tail=50"
    error "To rollback:    bash $SCRIPT_DIR/rollback.sh"
    exit 1
fi

# ── 11. Record deployment ─────────────────────────────────────────────────────
echo "$TAG $(date '+%Y-%m-%d %H:%M:%S')" >> "$DEPLOY_LOG"
success "Deployed $TAG successfully."
