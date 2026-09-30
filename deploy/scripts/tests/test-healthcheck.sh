#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTHCHECK_SCRIPT="$(cd "$SCRIPT_DIR/.." && pwd)/healthcheck.sh"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

cp "$HEALTHCHECK_SCRIPT" "$TEST_DIR/healthcheck.sh"
mkdir -p "$TEST_DIR/bin"
printf 'DOMAIN=example.com\n' > "$TEST_DIR/.env"

cat > "$TEST_DIR/env.sh" <<'EOF'
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

docker_compose() {
    if [ "$1" = "config" ] && [ "$2" = "--services" ]; then
        printf '%s\n' backend publisher caddy
        return
    fi
    if [ "$1" = "exec" ] && [ "$3" = "backend" ]; then
        if [[ "$*" == *"http://publisher:3000/"* ]]; then
            printf '%s\n' "$*" >> "$DIRECT_PAGE_LOG"
            if [ "${DIRECT_PAGE_MODE:-success}" = "failure" ] && [[ "$*" == *"summerstudy-test.colliberty.com"* ]]; then
                printf '404'
                return
            fi
        fi
        printf '200'
        return
    fi
    if [ "$1" = "exec" ] && [ "$3" = "publisher" ]; then
        case "$*" in
            *"PUBLISHER_TEST_HOST_MAPPINGS"*"join"*)
                printf '%s\n' eceee-test.colliberty.com summerstudy-test.colliberty.com industry-test.colliberty.com
                ;;
            *"api/health"*)
                [[ "$*" == *"AbortSignal.timeout("* ]] || return 1
                printf '200'
                ;;
            *)
                return 1
                ;;
        esac
        return
    fi
    return 1
}
EOF

cat > "$TEST_DIR/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

url="${!#}"
printf '%s\n' "$url" >> "$CURL_LOG"
if [ "${PUBLIC_HEALTH_MODE:-success}" = "failure" ] && [[ "$url" == *"summerstudy-test.colliberty.com"* ]]; then
    printf '503:nextjs'
    exit 22
fi
if [ "${PUBLIC_HEALTH_MODE:-success}" = "wrong-upstream" ]; then
    printf '200:'
    exit 0
fi
printf '200:nextjs'
EOF
chmod +x "$TEST_DIR/bin/curl"

CURL_LOG="$TEST_DIR/curl.log"
DIRECT_PAGE_LOG="$TEST_DIR/direct-page.log"
export CURL_LOG DIRECT_PAGE_LOG
PATH="$TEST_DIR/bin:$PATH" HEALTHCHECK_TIMEOUT=5 HEALTHCHECK_INTERVAL=1 \
    PUBLIC_HEALTH_MODE=success bash "$TEST_DIR/healthcheck.sh"

for host in eceee-test.colliberty.com summerstudy-test.colliberty.com industry-test.colliberty.com; do
    grep -Fxq "https://${host}/api/health" "$CURL_LOG"
    grep -Fq -- "--header Host: ${host} http://publisher:3000/" "$DIRECT_PAGE_LOG"
done

: > "$DIRECT_PAGE_LOG"
DIRECT_FAILURE_LOG="$TEST_DIR/direct-failure.log"
if PATH="$TEST_DIR/bin:$PATH" HEALTHCHECK_TIMEOUT=2 HEALTHCHECK_INTERVAL=1 \
    DIRECT_PAGE_MODE=failure PUBLIC_HEALTH_MODE=success bash "$TEST_DIR/healthcheck.sh" >"$DIRECT_FAILURE_LOG" 2>&1; then
    echo "healthcheck unexpectedly accepted a failing direct publisher page" >&2
    exit 1
fi
grep -Fq "direct test pages: summerstudy-test.colliberty.com:404" "$DIRECT_FAILURE_LOG"

: > "$CURL_LOG"
if PATH="$TEST_DIR/bin:$PATH" HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    PUBLIC_HEALTH_MODE=failure bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted a failing public HTTPS route" >&2
    exit 1
fi

if PATH="$TEST_DIR/bin:$PATH" HEALTHCHECK_TIMEOUT=1 HEALTHCHECK_INTERVAL=1 \
    PUBLIC_HEALTH_MODE=wrong-upstream bash "$TEST_DIR/healthcheck.sh" >/dev/null 2>&1; then
    echo "healthcheck unexpectedly accepted a 200 response without the publisher marker" >&2
    exit 1
fi

echo "healthcheck public HTTPS tests passed"
