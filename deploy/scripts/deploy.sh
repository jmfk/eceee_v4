#!/usr/bin/env bash
# deploy.sh - Deploy eceee_v4 to production
# Usage: bash deploy/scripts/deploy.sh [TAG|BRANCH]
#   TAG/BRANCH: git ref to deploy (default: origin/main)
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

# Reject dev-style hosts / missing DOMAIN (wrong cwd used to mask this before env.sh fix)
if ! grep -qE '^DOMAIN=[^[:space:]]' "$ENV_FILE"; then
    error "deploy/.env must set DOMAIN=your-domain.org (non-empty)."
    exit 1
fi
if grep -qE '^POSTGRES_HOST=eceee-v4-' "$ENV_FILE" 2>/dev/null; then
    error "deploy/.env uses dev POSTGRES_HOST (eceee-v4-*). Use POSTGRES_HOST=db for production compose."
    exit 1
fi
POSTGRES_HOST_VAL=$(grep '^POSTGRES_HOST=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '[:space:]')
if [ "$POSTGRES_HOST_VAL" != "db" ]; then
    error "deploy/.env POSTGRES_HOST must be db (compose service name); got: ${POSTGRES_HOST_VAL:-empty}"
    exit 1
fi
if grep -qE '^REDIS_URL=.*eceee-v4-redis' "$ENV_FILE" 2>/dev/null; then
    error "deploy/.env REDIS_URL must use host redis, not eceee-v4-redis (use redis://redis:6379/0)."
    exit 1
fi
if grep -qE '^SECRET_KEY=dev-secret-key-change-in-production' "$ENV_FILE" 2>/dev/null; then
    error "deploy/.env must not use the dev SECRET_KEY. Copy deploy/.env.production.example and set a strong key."
    exit 1
fi
_sk=$(grep '^SECRET_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r')
_sk="${_sk#\"}"; _sk="${_sk%\"}"
_sk="${_sk#\'}"; _sk="${_sk%\'}"
if [ "${#_sk}" -lt 50 ]; then
    error "deploy/.env SECRET_KEY must be at least 50 characters (length: ${#_sk}). Use: openssl rand -hex 32"
    exit 1
fi
unset _sk

# ── 2. Determine REF ─────────────────────────────────────────────────────────
REF="${1:-}"
if [ -z "$REF" ]; then
    git -C "$REPO" fetch origin --quiet
    REF="origin/main"
fi
# Resolve short SHA for Docker image tag (slashes are invalid in image tags)
IMAGE_TAG=$(git -C "$REPO" rev-parse --short "$REF")
info "Deploying: $REF (image tag: $IMAGE_TAG)"

# ── 3. Backup ─────────────────────────────────────────────────────────────────
info "Running pre-deploy backup..."
bash "$SCRIPT_DIR/backup.sh" || {
    warn "Backup failed — continuing anyway. Check /mnt/data/backups/ manually."
}

# ── 4. Git pull + checkout ────────────────────────────────────────────────────
info "Checking out $REF..."
git -C "$REPO" checkout --force "$REF" --quiet

# ── 5. Build images ───────────────────────────────────────────────────────────
info "Building images ($IMAGE_TAG)..."
IMAGE_TAG="$IMAGE_TAG" docker_compose build backend frontend playwright

# ── 6. Migration check ────────────────────────────────────────────────────────
info "Checking for unapplied migrations..."
if ! IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py migrate --check 2>/dev/null; then
    info "Pending migrations found — will apply after health check of current instance."
fi

# ── 7. Apply migrations ───────────────────────────────────────────────────────
info "Running migrations..."
IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py migrate --noinput

# ── 8. Collect static files ───────────────────────────────────────────────────
info "Collecting static files..."
IMAGE_TAG="$IMAGE_TAG" docker_compose run --rm backend python manage.py collectstatic --noinput --clear

# ── 9. Start/restart containers ───────────────────────────────────────────────
info "Stopping existing containers..."
docker_compose down --timeout 30 2>/dev/null || true
# Remove any stale containers not managed by compose (e.g. from manual runs)
docker rm -f $(docker ps -aq --filter "name=deploy-" 2>/dev/null) 2>/dev/null || true
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

# ── 11. Record deployment ─────────────────────────────────────────────────────
echo "$REF ($IMAGE_TAG) $(date '+%Y-%m-%d %H:%M:%S')" >> "$DEPLOY_LOG"
success "Deployed $REF ($IMAGE_TAG) successfully."
