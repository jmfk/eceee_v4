#!/usr/bin/env bash
# Simulate deployment control flow without Docker, SSH, credentials or application data.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eceee-deploy-migrations.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/repo/deploy/scripts" "$TEST_DIR/repo/.git" "$TEST_DIR/bin"
cp "$SCRIPT_DIR/../deploy.sh" "$TEST_DIR/repo/deploy/scripts/"
: > "$TEST_DIR/repo/deploy/.env"
export TEST_DIR
cat > "$TEST_DIR/repo/deploy/scripts/env.sh" <<'SH'
REPO="$TEST_DIR/repo"
DEPLOY_DIR="$REPO/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
acquire_production_operation_lock() { :; }
docker_compose() {
    case "$*" in
        'config --services') printf '%s\n' backend frontend celery-worker celery-beat publisher; return;;
        'build '*) echo "build $2" >> "$TEST_DIR/calls";;
        *'python -c'*) echo storage >> "$TEST_DIR/calls"; [[ "$FAIL_STAGE" != storage ]] || return 1;;
        *'migrate --plan') echo plan >> "$TEST_DIR/calls"; [[ "$FAIL_STAGE" != plan ]] || return 1;;
        *'migrate --check') echo check >> "$TEST_DIR/calls"; [[ "$PENDING" != yes ]] || return 1;;
        'stop --timeout 30 backend celery-worker celery-beat') echo pause >> "$TEST_DIR/calls";;
        *'migrate --noinput') echo migrate >> "$TEST_DIR/calls"; [[ "$FAIL_STAGE" != migrate ]] || return 1;;
        *'collectstatic --noinput --clear') echo static >> "$TEST_DIR/calls";;
        *'provision_publisher_roles') echo publisher-roles >> "$TEST_DIR/calls";;
        'down --timeout 30') echo down >> "$TEST_DIR/calls";;
        'up -d --remove-orphans') echo up >> "$TEST_DIR/calls";;
        *) echo 'Unexpected Compose invocation' >&2; return 1;;
    esac
}
SH
for script in validate-production-env backup healthcheck; do
    printf 'echo %s >> "$TEST_DIR/calls"\n' "$script" > "$TEST_DIR/repo/deploy/scripts/$script.sh"
done
printf 'echo fixturecommit\n' > "$TEST_DIR/repo/deploy/scripts/validate-deploy-control-ref.sh"
cat > "$TEST_DIR/bin/git" <<'SH'
#!/bin/sh
case "$*" in
    *'rev-parse --short'*) echo fixturecommit;;
    *'describe --tags --exact-match'*) echo v1.2.3;;
esac
SH
cat > "$TEST_DIR/bin/docker" <<'SH'
#!/bin/sh
exit 0
SH
chmod +x "$TEST_DIR/bin/git" "$TEST_DIR/bin/docker"
export PATH="$TEST_DIR/bin:$PATH"

run_deploy() {
    : > "$TEST_DIR/calls"
    PENDING="$1" FAIL_STAGE="$2" bash "$TEST_DIR/repo/deploy/scripts/deploy.sh" v1.2.3 > "$TEST_DIR/output" 2>&1
}

run_deploy yes none
cat > "$TEST_DIR/expected" <<'CALLS'
validate-production-env
backup
build backend
build frontend
build playwright
build publisher
storage
plan
check
pause
migrate
static
publisher-roles
down
up
healthcheck
CALLS
cmp "$TEST_DIR/expected" "$TEST_DIR/calls"
run_deploy no none
! grep -Fxq pause "$TEST_DIR/calls"
grep -Fxq up "$TEST_DIR/calls"
for failure in storage plan migrate; do
    if run_deploy yes "$failure"; then
        echo "Expected deploy failure at $failure" >&2; exit 1
    fi
    ! grep -Fxq up "$TEST_DIR/calls"
    ! grep -Fxq healthcheck "$TEST_DIR/calls"
    if [[ "$failure" == migrate ]]; then
        grep -Fxq pause "$TEST_DIR/calls"
    else
        ! grep -Fxq pause "$TEST_DIR/calls"
        ! grep -Fxq migrate "$TEST_DIR/calls"
    fi
done
echo 'deploy storage/migration writer-order and failure tests passed'
