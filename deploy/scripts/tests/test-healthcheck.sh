#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTHCHECK_SCRIPT="$(cd "$SCRIPT_DIR/.." && pwd)/healthcheck.sh"
TEST_DIR=$(mktemp -d)
DIRECT_SERVER_PID=""
cleanup() {
    if [ -n "$DIRECT_SERVER_PID" ]; then
        kill "$DIRECT_SERVER_PID" 2>/dev/null || true
        wait "$DIRECT_SERVER_PID" 2>/dev/null || true
    fi
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

cp "$HEALTHCHECK_SCRIPT" "$TEST_DIR/healthcheck.sh"
mkdir -p "$TEST_DIR/bin"
printf 'DOMAIN=example.com\n' > "$TEST_DIR/.env"

REAL_CURL=$(command -v curl)
DIRECT_SERVER_PORT_FILE="$TEST_DIR/direct-server.port"
DIRECT_SERVER_LOG="$TEST_DIR/direct-server.log"
# JavaScript template interpolation belongs to Node, not the shell.
# shellcheck disable=SC2016
PORT_FILE="$DIRECT_SERVER_PORT_FILE" HOST_LOG="$DIRECT_SERVER_LOG" node -e '
    const fs = require("node:fs");
    const http = require("node:http");
    const allowedHosts = new Set([
        "eceee-test.colliberty.com",
        "summerstudy-test.colliberty.com",
        "industry-test.colliberty.com",
    ]);
    const server = http.createServer((request, response) => {
        const hostname = request.headers.host || "";
        fs.appendFileSync(process.env.HOST_LOG, `${hostname}\n`);
        response.statusCode = request.url === "/" && allowedHosts.has(hostname) ? 200 : 404;
        response.end();
    });
    server.listen(0, "127.0.0.1", () => {
        fs.writeFileSync(process.env.PORT_FILE, String(server.address().port), { mode: 0o600 });
    });
    process.on("SIGTERM", () => server.close(() => process.exit(0)));
' &
DIRECT_SERVER_PID=$!
for _ in {1..50}; do
    [ -s "$DIRECT_SERVER_PORT_FILE" ] && break
    kill -0 "$DIRECT_SERVER_PID" 2>/dev/null || break
    sleep 0.1
done
if [ ! -s "$DIRECT_SERVER_PORT_FILE" ]; then
    echo "direct publisher test server did not start" >&2
    exit 1
fi
DIRECT_PROBE_PORT=$(<"$DIRECT_SERVER_PORT_FILE")
export REAL_CURL DIRECT_PROBE_PORT

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
            shift 4
            local argument
            local direct_arguments=()
            for argument in "$@"; do
                if [ "$argument" = "http://publisher:3000/" ]; then
                    argument="http://127.0.0.1:${DIRECT_PROBE_PORT}/"
                elif [ "${DIRECT_PAGE_MODE:-success}" = "failure" ] \
                    && [ "$argument" = "Host: summerstudy-test.colliberty.com" ]; then
                    argument="Host: rejected-test-host.invalid"
                fi
                direct_arguments+=("$argument")
            done
            "$REAL_CURL" "${direct_arguments[@]}"
            return
        fi
        printf '200'
        return
    fi
    if [ "$1" = "exec" ] && [ "$3" = "publisher" ]; then
        case "$*" in
            *"PUBLISHER_TEST_HOSTS"*"join"*)
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
    grep -Fxq "$host" "$DIRECT_SERVER_LOG"
done

: > "$DIRECT_PAGE_LOG"
DIRECT_FAILURE_LOG="$TEST_DIR/direct-failure.log"
if PATH="$TEST_DIR/bin:$PATH" HEALTHCHECK_TIMEOUT=2 HEALTHCHECK_INTERVAL=1 \
    DIRECT_PAGE_MODE=failure PUBLIC_HEALTH_MODE=success bash "$TEST_DIR/healthcheck.sh" >"$DIRECT_FAILURE_LOG" 2>&1; then
    echo "healthcheck unexpectedly accepted a failing direct publisher page" >&2
    exit 1
fi
grep -Fq "direct test pages: summerstudy-test.colliberty.com:404" "$DIRECT_FAILURE_LOG"
grep -Fxq "rejected-test-host.invalid" "$DIRECT_SERVER_LOG"

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
