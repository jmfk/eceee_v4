#!/usr/bin/env bash
# Resolve the production deploy ref to an immutable commit hash.
#
# Usage: bash deploy/scripts/resolve-deploy-ref.sh [TAG|HASH|REF]
#   No argument deploys the latest origin/main fetched at invocation time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"

REQUESTED_REF="${1:-}"
DEFAULT_REF="${DEFAULT_DEPLOY_REF:-origin/main}"

git -C "$REPO" fetch origin --tags --prune --quiet

if [ -z "$REQUESTED_REF" ]; then
    REF="$DEFAULT_REF"
else
    REF="$REQUESTED_REF"
fi

if ! RESOLVED_REF=$(git -C "$REPO" rev-parse --verify --quiet "${REF}^{commit}"); then
    echo "Error: could not resolve deploy ref '$REF'. Use no TAG for latest main, or set TAG to a tag, commit hash, or valid git ref." >&2
    exit 1
fi

printf '%s\n' "$RESOLVED_REF"
