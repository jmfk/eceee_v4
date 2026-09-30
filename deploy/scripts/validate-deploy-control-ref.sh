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

if ! git -C "$REPO" merge-base --is-ancestor "$TARGET_COMMIT" origin/main; then
    if ! MERGE_BASE=$(git -C "$REPO" merge-base origin/main "$TARGET_COMMIT"); then
        echo "[deploy-control] Deploy ref has no merge base with origin/main." >&2
        exit 2
    fi
    if ! git -C "$REPO" diff --quiet "$MERGE_BASE" "$TARGET_COMMIT" -- \
        .dockerignore deploy/scripts/ deploy/docker-compose.prod.yml deploy/Caddyfile; then
        echo "[deploy-control] Target contains deployment-control changes that are not on origin/main." >&2
        echo "[deploy-control] Merge those changes to main, then deploy the merged commit." >&2
        exit 1
    fi
fi

printf '%s\n' "$TARGET_COMMIT"
