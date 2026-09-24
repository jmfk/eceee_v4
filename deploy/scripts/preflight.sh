#!/usr/bin/env bash
# Run production preflight checks against the exact commit that will be deployed.
#
# Usage: bash deploy/scripts/preflight.sh [TAG|HASH|REF]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"

REQUESTED_REF="${1:-}"
DISPLAY_REF="${REQUESTED_REF:-origin/main}"
RESOLVED_REF="$("$SCRIPT_DIR/resolve-deploy-ref.sh" "$REQUESTED_REF")"
SHORT_REF="$(git -C "$REPO" rev-parse --short "$RESOLVED_REF")"

info() {
    echo "[preflight] $*"
}

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/eceee-prod-preflight.XXXXXX")"
WORKTREE="$TMP_ROOT/worktree"
BACKEND_WAS_RUNNING=0
FRONTEND_WAS_RUNNING=0

if docker compose --project-directory "$REPO" -f "$REPO/docker-compose.dev.yml" ps --status running -q backend | grep -q .; then
    BACKEND_WAS_RUNNING=1
fi
if docker compose --project-directory "$REPO" -f "$REPO/docker-compose.dev.yml" ps --status running -q frontend | grep -q .; then
    FRONTEND_WAS_RUNNING=1
fi

cleanup() {
    local status=$?

    if [ -f "$WORKTREE/docker-compose.dev.yml" ]; then
        docker compose --project-directory "$WORKTREE" -f "$WORKTREE/docker-compose.dev.yml" \
            stop backend frontend >/dev/null 2>&1 || true
    fi

    if git -C "$REPO" worktree list --porcelain | grep -Fqx "worktree $WORKTREE"; then
        git -C "$REPO" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
    fi
    rm -rf "$TMP_ROOT" || true

    if [ "$BACKEND_WAS_RUNNING" -eq 1 ]; then
        docker compose --project-directory "$REPO" -f "$REPO/docker-compose.dev.yml" \
            up -d --force-recreate backend >/dev/null 2>&1 || true
    fi
    if [ "$FRONTEND_WAS_RUNNING" -eq 1 ]; then
        docker compose --project-directory "$REPO" -f "$REPO/docker-compose.dev.yml" \
            up -d --force-recreate frontend >/dev/null 2>&1 || true
    fi

    exit "$status"
}
trap cleanup EXIT

info "Checking $DISPLAY_REF at $SHORT_REF..."
git -C "$REPO" worktree add --detach --quiet "$WORKTREE" "$RESOLVED_REF"

if [ -f "$REPO/.env" ]; then
    cp "$REPO/.env" "$WORKTREE/.env"
else
    : > "$WORKTREE/.env"
fi

PREFLIGHT_TARGETS="${PREFLIGHT_TARGETS:-lint test regression-test}"
NEEDS_FRONTEND_DEPS=0
for target in $PREFLIGHT_TARGETS; do
    case "$target" in
        lint|regression-test|frontend-e2e-test|frontend-admin-e2e-test)
            NEEDS_FRONTEND_DEPS=1
            ;;
    esac
done

if [ "$NEEDS_FRONTEND_DEPS" -eq 1 ] && [ -f "$WORKTREE/frontend/package-lock.json" ]; then
    info "Installing frontend dependencies for checked commit..."
    npm --prefix "$WORKTREE/frontend" ci
fi

for target in $PREFLIGHT_TARGETS; do
    info "Running make $target..."
    SHARED_LOCAL_INFRA_ROOT="${SHARED_LOCAL_INFRA_ROOT:-$REPO/../shared-local-infrastructure}" \
        make -C "$WORKTREE" "$target"
done

if [ -n "${PREFLIGHT_RESOLVED_REF_FILE:-}" ]; then
    printf '%s\n' "$RESOLVED_REF" > "$PREFLIGHT_RESOLVED_REF_FILE"
fi

info "Checks passed for $SHORT_REF."
