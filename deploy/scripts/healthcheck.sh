#!/usr/bin/env bash
# healthcheck.sh - Verify production deployment is healthy
# Usage: bash deploy/scripts/healthcheck.sh
# Exits 0 on success, 1 on timeout.

set -euo pipefail

REPO=$(pwd)
COMPOSE_FILE="$REPO/docker-compose.production.yml"
URL="${HEALTH_CHECK_URL:-http://localhost:8000/health/}"
TIMEOUT=90
INTERVAL=5

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[health]${NC} $*"; }
success() { echo -e "${GREEN}[health]${NC} $*"; }
error()   { echo -e "${RED}[health]${NC} $*" >&2; }

info "Polling $URL (timeout: ${TIMEOUT}s)..."

elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
    STATUS=$(docker compose -f "$COMPOSE_FILE" exec -T backend curl -sf --max-time 5 -o /dev/null -w '%{http_code}' http://localhost:8000/health/ 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ]; then
        success "Health check passed after ${elapsed}s (HTTP $STATUS)."
        exit 0
    fi
    sleep "$INTERVAL"
    elapsed=$((elapsed + INTERVAL))
    info "  ...waiting (${elapsed}s elapsed, last status: $STATUS)"
done

error "Health check timed out after ${TIMEOUT}s."
error "Check logs: docker compose -f $COMPOSE_FILE logs --tail=50 backend"
exit 1
