#!/usr/bin/env bash
# healthcheck.sh - Verify production deployment is healthy
# Usage: bash deploy/scripts/healthcheck.sh
# Exits 0 on success, 1 on timeout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/env.sh
source "$SCRIPT_DIR/env.sh"
cd "$DEPLOY_DIR" || exit 1

TIMEOUT=${HEALTHCHECK_TIMEOUT:-90}
INTERVAL=${HEALTHCHECK_INTERVAL:-5}

# Load DOMAIN from .env for Host header
DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r')
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

info "Polling backend and publisher health (timeout: ${TIMEOUT}s, host: $DOMAIN)..."

PUBLISHER_DEPLOY_ENABLED=0
PUBLISHER_PUBLIC_HOSTS=${PUBLISHER_PUBLIC_HOSTS:-"summerstudy.$DOMAIN industry.$DOMAIN"}
PUBLISHER_PUBLIC_ROUTE_CHECK=0
if grep -Fq 'header X-ECEEE-Renderer "nextjs"' "$DEPLOY_DIR/Caddyfile"; then
    PUBLISHER_PUBLIC_ROUTE_CHECK=1
fi
COMPOSE_SERVICES=$(docker_compose config --services)
if grep -Fxq publisher <<< "$COMPOSE_SERVICES"; then
    PUBLISHER_DEPLOY_ENABLED=1
fi
unset COMPOSE_SERVICES

started_at=$SECONDS
deadline=$((started_at + TIMEOUT))
while [ "$SECONDS" -lt "$deadline" ]; do
    remaining=$((deadline - SECONDS))
    backend_timeout=$((remaining < 5 ? remaining : 5))
    BACKEND_STATUS=$(docker_compose exec -T backend curl -s --max-time "$backend_timeout" -H "Host: $DOMAIN" -o /dev/null -w '%{http_code}' http://localhost:8000/health/ 2>/dev/null || echo "000")
    PUBLISHER_STATUS="not-configured"
    if [ "$PUBLISHER_PUBLIC_ROUTE_CHECK" -eq 1 ]; then
        PUBLISHER_ROUTES_STATUS="required-but-unavailable"
    else
        PUBLISHER_ROUTES_STATUS="not-required"
    fi
    if [ "$PUBLISHER_DEPLOY_ENABLED" -eq 1 ]; then
        remaining=$((deadline - SECONDS))
        [ "$remaining" -gt 0 ] || break
        publisher_timeout_ms=$(((remaining < 5 ? remaining : 5) * 1000))
        PUBLISHER_STATUS=$(docker_compose exec -T publisher node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(${publisher_timeout_ms})}).then(async r=>{process.stdout.write(String(r.status)); if(!r.ok)process.exit(1)}).catch(()=>{process.stdout.write('000');process.exit(1)})" 2>/dev/null || true)
        if [ "$PUBLISHER_PUBLIC_ROUTE_CHECK" -eq 1 ]; then
            publisher_routes_complete=1
            publisher_routes_checked=0
            for publisher_host in $PUBLISHER_PUBLIC_HOSTS; do
                remaining=$((deadline - SECONDS))
                if [ "$remaining" -le 0 ]; then
                    PUBLISHER_ROUTES_STATUS="$publisher_host:000:timeout"
                    publisher_routes_complete=0
                    break
                fi
                route_timeout=$((remaining < 5 ? remaining : 5))
                route_headers=$(docker_compose exec -T backend curl --silent --show-error --max-time "$route_timeout" --dump-header - --output /dev/null "https://$publisher_host/" 2>/dev/null || true)
                normalized_headers=$(printf '%s' "$route_headers" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
                route_status=$(printf '%s\n' "$normalized_headers" | awk '$1 ~ /^http\// { value=$2 } END { print value }')
                route_renderer=$(printf '%s\n' "$normalized_headers" | awk '$1 == "x-eceee-renderer:" { value=$2 } END { print value }')
                if [ "$route_status" != "200" ] || [ "$route_renderer" != "nextjs" ]; then
                    PUBLISHER_ROUTES_STATUS="$publisher_host:${route_status:-000}:${route_renderer:-missing}"
                    publisher_routes_complete=0
                    break
                fi
                publisher_routes_checked=$((publisher_routes_checked + 1))
            done
            if [ "$publisher_routes_complete" -eq 1 ] && [ "$publisher_routes_checked" -gt 0 ]; then
                PUBLISHER_ROUTES_STATUS="200:nextjs"
            fi
        fi
    fi
    if [ "$BACKEND_STATUS" = "200" ] \
        && { { [ "$PUBLISHER_DEPLOY_ENABLED" -eq 0 ] \
                && [ "$PUBLISHER_PUBLIC_ROUTE_CHECK" -eq 0 ]; } \
            || { [ "$PUBLISHER_STATUS" = "200" ] \
                && { [ "$PUBLISHER_PUBLIC_ROUTE_CHECK" -eq 0 ] \
                    || [ "$PUBLISHER_ROUTES_STATUS" = "200:nextjs" ]; }; }; }; then
        elapsed=$((SECONDS - started_at))
        success "Health checks passed after ${elapsed}s (backend: $BACKEND_STATUS, publisher: $PUBLISHER_STATUS, public routes: $PUBLISHER_ROUTES_STATUS)."
        exit 0
    fi
    remaining=$((deadline - SECONDS))
    [ "$remaining" -gt 0 ] || break
    sleep_for=$((remaining < INTERVAL ? remaining : INTERVAL))
    sleep "$sleep_for"
    elapsed=$((SECONDS - started_at))
    info "  ...waiting (${elapsed}s elapsed, backend: ${BACKEND_STATUS:-000}, publisher: ${PUBLISHER_STATUS:-000}, public routes: ${PUBLISHER_ROUTES_STATUS:-not-checked})"
done

error "Health check timed out after ${TIMEOUT}s."
error "Check logs: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml --env-file \"$ENV_FILE\" logs --tail=50 backend publisher caddy"
exit 1
