#!/usr/bin/env bash
# setup-env.sh - Securely push local deploy/.env to production server
# Usage: bash deploy/scripts/setup-env.sh [PROD_HOST] [PROD_DIR]
#   PROD_HOST: SSH target (default: root@eceee-vps)
#   PROD_DIR:  Remote path (default: /srv/eceee_v4)

set -euo pipefail

LOCAL_ENV="deploy/.env"
PROD_HOST="${1:-root@eceee-vps}"
PROD_DIR="${2:-/srv/eceee_v4}"
REMOTE_ENV="$PROD_DIR/deploy/.env"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[env]${NC} $*"; }
success() { echo -e "${GREEN}[env]${NC} $*"; }
warn()    { echo -e "${YELLOW}[env]${NC} $*"; }
error()   { echo -e "${RED}[env]${NC} $*" >&2; }

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
info "Pushing $LOCAL_ENV to $PROD_HOST:$REMOTE_ENV..."

# Create directory if it doesn't exist and set permissions
ssh "$PROD_HOST" "mkdir -p $PROD_DIR/deploy && chmod 700 $PROD_DIR/deploy"

# Securely copy the file
scp "$LOCAL_ENV" "$PROD_HOST":"$REMOTE_ENV"

# Set restrictive permissions on the remote file
ssh "$PROD_HOST" "chmod 600 $REMOTE_ENV"

success "Successfully pushed and secured .env on production."
