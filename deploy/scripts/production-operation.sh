#!/usr/bin/env bash
# Run production operations that must not overlap service-state maintenance.
# This script may be piped to bash and therefore resolves paths from the repo cwd.

set -euo pipefail

REPO="$(pwd -P)"
DEPLOY_DIR="$REPO/deploy"
SCRIPT_DIR="$DEPLOY_DIR/scripts"
ENV_FILE="$DEPLOY_DIR/.env"
OPERATION="${1:-}"
STAGED_ENV="${2:-}"
REF="${3:-}"
LOCK_FILE="/mnt/data/.eceee-production-operation.lock"

case "$OPERATION" in
    deploy|restart|install-env) ;;
    *)
        echo "[production-operation] Expected deploy, restart, or install-env." >&2
        exit 2
        ;;
esac

case "$STAGED_ENV" in
    "$DEPLOY_DIR"/.env.incoming.*) ;;
    *)
        echo "[production-operation] Refusing unexpected staged environment path." >&2
        exit 2
        ;;
esac
if [ ! -f "$STAGED_ENV" ]; then
    echo "[production-operation] Staged environment file does not exist." >&2
    exit 2
fi

cleanup_stage() {
    rm -f "$STAGED_ENV"
}
trap cleanup_stage EXIT

if ! command -v flock >/dev/null 2>&1; then
    echo "[production-operation] flock is required for production operation locking." >&2
    exit 1
fi
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[production-operation] Another deploy, restore, or maintenance operation is already running." >&2
    exit 1
fi
export ECEEE_PRODUCTION_LOCK_FD=200

chmod 600 "$STAGED_ENV"
mv -f "$STAGED_ENV" "$ENV_FILE"
STAGED_ENV=""
trap - EXIT

case "$OPERATION" in
    install-env)
        echo "[production-operation] Production environment installed."
        ;;
    restart)
        # shellcheck source=deploy/scripts/env.sh
        source "$SCRIPT_DIR/env.sh"
        docker_compose up -d
        bash "$SCRIPT_DIR/healthcheck.sh"
        ;;
    deploy)
        if [ -z "$REF" ]; then
            echo "[production-operation] Deploy ref is required." >&2
            exit 2
        fi
        git -C "$REPO" fetch origin --tags --prune --quiet
        git -C "$REPO" checkout --force origin/main -- deploy/scripts/
        bash "$SCRIPT_DIR/deploy.sh" "$REF"
        ;;
esac
