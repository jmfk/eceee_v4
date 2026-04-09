#!/usr/bin/env bash
# healthcheck.sh - Verify production deployment is healthy
# Usage: bash deploy/scripts/healthcheck.sh
# Exits 0 on success, 1 on timeout.

set -euo pipefail

REPO=$(pwd)
ENV_FILE="$REPO/deploy/.env"
COMPOSE_FILE="$REPO/deploy/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
TIMEOUT=90
INTERVAL=5

# Load DOMAIN from .env for Host header
DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | tail -1 | cut -d= -f2)
if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost"
fi

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[health]${NC} $*"; }
success() { echo -e "${GREEN}[health]${NC} $*"; }
error()   { echo -e "${RED}[health]${NC} $*" >&2; }

info "Polling backend health (timeout: ${TIMEOUT}s, host: $DOMAIN)..."

elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
    STATUS=$($COMPOSE exec -T backend curl -s --max-time 5 -H "Host: $DOMAIN" -o /dev/null -w '%{http_code}' http://localhost:8000/health/ 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        success "Health check passed after ${elapsed}s (HTTP $STATUS)."
        exit 0
    fi
    sleep "$INTERVAL"
    elapsed=$((elapsed + INTERVAL))
    info "  ...waiting (${elapsed}s elapsed, last status: $STATUS)"
done

error "Health check timed out after ${TIMEOUT}s."
error "Check logs: $COMPOSE logs --tail=50 backend"
exit 1
