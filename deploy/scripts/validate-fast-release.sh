#!/usr/bin/env bash
# Limit the narrow production preflight to frontend-only changes since the
# exact commit currently deployed in production.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_REF="${1:-}"
TARGET_REF="${2:-}"
RELEASE_TAG="${3:-}"

if [[ ! "$BASE_REF" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || [ -z "$TARGET_REF" ]; then
    echo "[fast-release] An exact 40-character production commit and version tag are required." >&2
    exit 2
fi

BASE_COMMIT=$(git -C "$REPO" rev-parse --verify --end-of-options "${BASE_REF}^{commit}")
TARGET_COMMIT=$(git -C "$REPO" rev-parse --verify --end-of-options "${TARGET_REF}^{commit}")
TAG_COMMIT=$(git -C "$REPO" rev-parse --verify --end-of-options "refs/tags/${RELEASE_TAG}^{commit}")
if [ "$TAG_COMMIT" != "$TARGET_COMMIT" ]; then
    echo "[fast-release] Tag does not resolve to the selected deploy commit." >&2
    exit 2
fi
if ! git -C "$REPO" merge-base --is-ancestor "$BASE_COMMIT" "$TARGET_COMMIT"; then
    echo "[fast-release] Production base is not an ancestor of the release." >&2
    exit 2
fi

CHANGED=0
while IFS= read -r -d '' path; do
    CHANGED=1
    case "$path" in
        frontend/src/*|frontend/public/*|frontend/index.html) ;;
        *)
            echo "[fast-release] Full preflight required: change outside frontend ($path)." >&2
            exit 2
            ;;
    esac
done < <(git -C "$REPO" diff --name-only -z "$BASE_COMMIT" "$TARGET_COMMIT")

if [ "$CHANGED" -eq 0 ]; then
    echo "[fast-release] No changes since the production base." >&2
    exit 2
fi

echo "[fast-release] Frontend-only diff verified against production base $BASE_COMMIT."
