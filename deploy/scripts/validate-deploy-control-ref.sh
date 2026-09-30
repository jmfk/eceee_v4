#!/usr/bin/env bash
# Resolve a deploy target while keeping production control-plane changes on main.
# Usage: validate-deploy-control-ref.sh REPO REF

set -euo pipefail

REPO="${1:?Repository path is required}"
REF="${2:?Deploy ref is required}"

if ! TARGET_COMMIT=$(git -C "$REPO" rev-parse --verify --quiet "${REF}^{commit}"); then
    echo "[deploy-control] Deploy ref does not resolve to a commit." >&2
    exit 2
fi

if ! git -C "$REPO" merge-base --is-ancestor "$TARGET_COMMIT" origin/main \
    && ! git -C "$REPO" diff --quiet origin/main "$TARGET_COMMIT" -- \
        deploy/scripts/ deploy/docker-compose.prod.yml deploy/Caddyfile; then
    echo "[deploy-control] Target contains deployment-control changes that are not on origin/main." >&2
    echo "[deploy-control] Merge those changes to main, then deploy the merged commit." >&2
    exit 1
fi

printf '%s\n' "$TARGET_COMMIT"
