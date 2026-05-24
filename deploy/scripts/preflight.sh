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

cleanup() {
    local status=$?

    if git -C "$REPO" worktree list --porcelain | grep -Fqx "worktree $WORKTREE"; then
        git -C "$REPO" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
    fi
    rm -rf "$TMP_ROOT"

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
    make -C "$WORKTREE" "$target"
done

if [ -n "${PREFLIGHT_RESOLVED_REF_FILE:-}" ]; then
    printf '%s\n' "$RESOLVED_REF" > "$PREFLIGHT_RESOLVED_REF_FILE"
fi

info "Checks passed for $SHORT_REF."
