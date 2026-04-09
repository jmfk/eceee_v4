#!/usr/bin/env bash
# deploy.sh - Deploy eceee_v4 to production
# Usage: bash deploy/scripts/deploy.sh [TAG]
#   TAG: git tag to deploy (default: latest tag on current branch)
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

# ── 2. Determine TAG ──────────────────────────────────────────────────────────
TAG="${1:-}"
if [ -z "$TAG" ]; then
    TAG=$(git -C "$REPO" describe --tags --abbrev=0 2>/dev/null || true)
fi
if [ -z "$TAG" ]; then
    error "No TAG provided and no git tags found. Usage: bash deploy/scripts/deploy.sh v0.1.0"
    exit 1
fi
info "Deploying tag: $TAG"

# ── 3. Backup ─────────────────────────────────────────────────────────────────
info "Running pre-deploy backup..."
bash "$SCRIPT_DIR/backup.sh" || {
    warn "Backup failed — continuing anyway. Check /mnt/data/backups/ manually."
}

# ── 4. Git pull + checkout ────────────────────────────────────────────────────
info "Fetching tags and checking out $TAG..."
git -C "$REPO" fetch --tags --quiet
git -C "$REPO" checkout "$TAG" --quiet

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
info "Bringing up containers..."
IMAGE_TAG="$TAG" $COMPOSE up -d --remove-orphans

# ── 9b. Reload Caddy config (zero-downtime TLS + routing refresh) ────────────
info "Reloading Caddy configuration..."
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force 2>/dev/null || warn "Caddy reload failed — may need manual restart."

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
