#!/usr/bin/env bash
# setup-env.sh - Securely install deploy/.env with an optional locked operation.
# Usage: bash deploy/scripts/setup-env.sh [PROD_HOST] [PROD_DIR] [--deploy REF|--restart]
#   PROD_HOST: SSH target (default: root@eceee-vps)
#   PROD_DIR:  Remote path (default: /srv/eceee_v4)

set -euo pipefail

LOCAL_ENV="deploy/.env"
PROD_HOST="${1:-root@eceee-vps}"
PROD_DIR="${2:-/srv/eceee_v4}"
MODE="${3:-install}"
REF="${4:-}"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[env]${NC} $*" >&2; }
success() { echo -e "${GREEN}[env]${NC} $*" >&2; }
warn()    { echo -e "${YELLOW}[env]${NC} $*" >&2; }
error()   { echo -e "${RED}[env]${NC} $*" >&2; }

case "$MODE" in
    install|--restart) ;;
    --deploy)
        if [ -z "$REF" ]; then
            error "--deploy requires a resolved Git ref."
            exit 2
        fi
        ;;
    *)
        error "Third argument must be --deploy or --restart when provided."
        exit 2
        ;;
esac

# ── 1. Check local .env ───────────────────────────────────────────────────────
if [ ! -f "$LOCAL_ENV" ]; then
    if [ -f "deploy/.env.production.example" ]; then
        info "Local $LOCAL_ENV not found. Creating from example..."
        cp deploy/.env.production.example "$LOCAL_ENV"
        warn "Please edit $LOCAL_ENV with production secrets before continuing."
        exit 1
    else
        error "Local $LOCAL_ENV and example not found. Are you in the repo root?"
        exit 1
    fi
fi

# ── 2. Validate .env (basic check) ────────────────────────────────────────────
if grep -q "your-long-random-secret-key" "$LOCAL_ENV" || grep -q "your-secure-postgres-password" "$LOCAL_ENV"; then
    error "Local $LOCAL_ENV still contains placeholder values. Please update it."
    exit 1
fi

# ── 3. Push to server ─────────────────────────────────────────────────────────
info "Staging $LOCAL_ENV on $PROD_HOST..."

# Create the protected directory and remove abandoned staging files from older
# failed invocations without touching a currently active transfer.
ssh "$PROD_HOST" \
    "mkdir -p '$PROD_DIR/deploy' && chmod 700 '$PROD_DIR/deploy' && find '$PROD_DIR/deploy' -maxdepth 1 -type f -name '.env.incoming.*' -mmin +60 -delete"

REMOTE_STAGE=$(ssh "$PROD_HOST" "mktemp '$PROD_DIR/deploy/.env.incoming.XXXXXX'")
cleanup_stage() {
    if [ -n "${REMOTE_STAGE:-}" ]; then
        ssh "$PROD_HOST" "rm -f '$REMOTE_STAGE'" >/dev/null 2>&1 || true
    fi
}
trap cleanup_stage EXIT

scp "$LOCAL_ENV" "$PROD_HOST":"$REMOTE_STAGE"
ssh "$PROD_HOST" "chmod 600 '$REMOTE_STAGE'"

case "$MODE" in
    install) OPERATION="install-env" ;;
    --restart) OPERATION="restart" ;;
    --deploy) OPERATION="deploy" ;;
esac

ssh "$PROD_HOST" "cd '$PROD_DIR' && bash -s -- '$OPERATION' '$REMOTE_STAGE' '$REF'" \
    < deploy/scripts/production-operation.sh
REMOTE_STAGE=""
trap - EXIT
success "Successfully installed and secured .env during $OPERATION."
