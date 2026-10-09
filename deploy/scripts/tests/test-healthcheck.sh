#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTHCHECK_SCRIPT="$(cd "$SCRIPT_DIR/.." && pwd)/healthcheck.sh"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

cp "$HEALTHCHECK_SCRIPT" "$TEST_DIR/healthcheck.sh"
printf 'DOMAIN=example.com\n' > "$TEST_DIR/.env"
printf 'header X-ECEEE-Renderer "nextjs"\n' > "$TEST_DIR/Caddyfile"

cat > "$TEST_DIR/env.sh" <<'EOF'
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

docker_compose() {
    if [ "$1" = "config" ] && [ "$2" = "--services" ]; then
        printf '%s\n' backend
        if [ "${PUBLISHER_ENABLED:-1}" = "1" ]; then
            printf '%s\n' publisher
        fi
        return 0
    fi
    if [ "$1" = "exec" ] && [ "$3" = "backend" ]; then
        case "$*" in
            *"https://summerstudy.example.com/"*)
                printf 'HTTP/2 %s\r\nX-ECEEE-Renderer: %s\r\n\r\n' \
                    "${TEST_SUMMERSTUDY_STATUS:-200}" "${TEST_SUMMERSTUDY_RENDERER:-nextjs}"
                ;;
            *"https://industry.example.com/"*)
                printf 'HTTP/2 %s\r\nX-ECEEE-Renderer: %s\r\n\r\n' \
                    "${TEST_INDUSTRY_STATUS:-200}" "${TEST_INDUSTRY_RENDERER:-nextjs}"
                ;;
            *)
                printf '%s' "${TEST_BACKEND_STATUS:-200}"
                ;;
        esac
        return
    fi
    if [ "$1" = "exec" ] && [ "$3" = "publisher" ]; then
        case "$*" in
            *"api/health"*)
                sleep "${TEST_PUBLISHER_DELAY:-0}"
                printf '%s' "${TEST_PUBLISHER_STATUS:-200}"
                return
                ;;
        esac
    fi
    return 1
}
EOF

SUCCESS_LOG="$TEST_DIR/success.log"
HEALTHCHECK_TIMEOUT=2 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" > "$SUCCESS_LOG"
grep -Fq "backend: 200, publisher: 200, public routes: 200:nextjs" "$SUCCESS_LOG"

if PUBLISHER_ENABLED=0 HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted publisher routes without a publisher service" >&2
    exit 1
fi

printf '# Django public fallback\n' > "$TEST_DIR/Caddyfile"

NO_PUBLISHER_LOG="$TEST_DIR/no-publisher.log"
PUBLISHER_ENABLED=0 HEALTHCHECK_TIMEOUT=2 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" > "$NO_PUBLISHER_LOG"
grep -Fq "backend: 200, publisher: not-configured, public routes: not-required" "$NO_PUBLISHER_LOG"

ROLLBACK_WITH_PUBLISHER_LOG="$TEST_DIR/rollback-with-publisher.log"
TEST_INDUSTRY_STATUS=503 TEST_SUMMERSTUDY_RENDERER=django \
    HEALTHCHECK_TIMEOUT=2 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" > "$ROLLBACK_WITH_PUBLISHER_LOG"
grep -Fq "backend: 200, publisher: 200, public routes: not-required" "$ROLLBACK_WITH_PUBLISHER_LOG"

if TEST_BACKEND_STATUS=503 HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted an unhealthy backend" >&2
    exit 1
fi

if TEST_PUBLISHER_STATUS=503 HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted an unhealthy publisher" >&2
    exit 1
fi

printf 'header X-ECEEE-Renderer "nextjs"\n' > "$TEST_DIR/Caddyfile"

if TEST_PUBLISHER_DELAY=1 HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly passed without checking the public publisher routes" >&2
    exit 1
fi

if PUBLISHER_PUBLIC_HOSTS='   ' HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted an empty public publisher host list" >&2
    exit 1
fi

if TEST_INDUSTRY_STATUS=503 HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted an unhealthy public publisher route" >&2
    exit 1
fi

if TEST_SUMMERSTUDY_RENDERER=django HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted a public route served by Django" >&2
    exit 1
fi

echo "healthcheck service tests passed"
