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
LOCK_FILE="${ECEEE_PRODUCTION_LOCK_FILE:-/mnt/data/.eceee-production-operation.lock}"
PREVIOUS_ENV=""
HAD_PREVIOUS_ENV=0
ENV_INSTALLED=0
ENV_COMMIT_MARKER="$DEPLOY_DIR/.env.commit.$$"

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
    local status=$?
    if [ -n "$STAGED_ENV" ]; then
        rm -f "$STAGED_ENV"
    fi
    if [ "$status" -ne 0 ] && [ "$ENV_INSTALLED" -eq 1 ] && [ ! -f "$ENV_COMMIT_MARKER" ]; then
        if [ "$HAD_PREVIOUS_ENV" -eq 1 ] && [ -f "$PREVIOUS_ENV" ]; then
            mv -f "$PREVIOUS_ENV" "$ENV_FILE"
            PREVIOUS_ENV=""
            echo "[production-operation] Restored the previous environment before runtime mutation." >&2
        else
            rm -f "$ENV_FILE"
        fi
    fi
    if [ -n "$PREVIOUS_ENV" ]; then
        rm -f "$PREVIOUS_ENV"
    fi
    rm -f "$ENV_COMMIT_MARKER"
    return "$status"
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

TARGET_COMMIT=""
if [ "$OPERATION" = "deploy" ]; then
    if [ -z "$REF" ]; then
        echo "[production-operation] Deploy ref is required." >&2
        exit 2
    fi

    git -C "$REPO" fetch origin --tags --prune --quiet
    git -C "$REPO" checkout --no-overlay --force origin/main -- \
        deploy/scripts/validate-deploy-control-ref.sh \
        deploy/scripts/validate-production-env.sh
    TARGET_COMMIT=$(bash "$SCRIPT_DIR/validate-deploy-control-ref.sh" "$REPO" "$REF")
fi

if [ "$OPERATION" = "restart" ] || { [ "$OPERATION" = "install-env" ] && [ -f "$ENV_FILE" ]; }; then
    bash "$SCRIPT_DIR/validate-production-env.sh" "$STAGED_ENV" --publisher-passwords-match "$ENV_FILE"
else
    bash "$SCRIPT_DIR/validate-production-env.sh" "$STAGED_ENV"
fi

if [ -f "$ENV_FILE" ]; then
    PREVIOUS_ENV=$(mktemp "$DEPLOY_DIR/.env.previous.XXXXXX")
    chmod 600 "$PREVIOUS_ENV"
    cp "$ENV_FILE" "$PREVIOUS_ENV"
    chmod 600 "$PREVIOUS_ENV"
    HAD_PREVIOUS_ENV=1
fi
chmod 600 "$STAGED_ENV"
mv -f "$STAGED_ENV" "$ENV_FILE"
STAGED_ENV=""
ENV_INSTALLED=1

case "$OPERATION" in
    install-env)
        : > "$ENV_COMMIT_MARKER"
        echo "[production-operation] Production environment installed."
        ;;
    restart)
        # shellcheck source=deploy/scripts/env.sh
        source "$SCRIPT_DIR/env.sh"
        : > "$ENV_COMMIT_MARKER"
        docker_compose up -d
        bash "$SCRIPT_DIR/healthcheck.sh"
        ;;
    deploy)
        git -C "$REPO" checkout --no-overlay --force origin/main -- deploy/scripts/
        ECEEE_ENV_COMMIT_MARKER="$ENV_COMMIT_MARKER" bash "$SCRIPT_DIR/deploy.sh" "$TARGET_COMMIT"
        ;;
esac
