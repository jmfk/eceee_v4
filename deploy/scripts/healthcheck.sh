#!/usr/bin/env bash
# healthcheck.sh - Verify production deployment is healthy
# Usage: bash deploy/scripts/healthcheck.sh
# Exits 0 on success, 1 on timeout.

set -euo pipefail

URL="https://eceee.fred.nu/health/"
TIMEOUT=60   # total seconds to wait
INTERVAL=5   # seconds between attempts

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
    if curl -sf --max-time 5 "$URL" > /dev/null 2>&1; then
        success "Health check passed after ${elapsed}s."
        exit 0
    fi
    sleep "$INTERVAL"
    elapsed=$((elapsed + INTERVAL))
    info "  ...waiting (${elapsed}s elapsed)"
done

error "Health check timed out after ${TIMEOUT}s."
error "The app may still be starting — check logs:"
error "  docker compose -f /opt/eceee/app/deploy/docker-compose.prod.yml logs --tail=50 backend"
exit 1
