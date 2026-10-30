#!/usr/bin/env bash
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/validate-fast-release.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"
mkdir -p "$REPO/deploy/scripts" "$REPO/frontend/src"
cp "$SOURCE" "$REPO/deploy/scripts/"
git -C "$REPO" init -q
git -C "$REPO" -c user.name=Test -c user.email=test@example.com \
    commit --allow-empty -qm base
BASE=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" tag v0.0.0

printf 'export const label = "fixed"\n' > "$REPO/frontend/src/label.js"
git -C "$REPO" add frontend/src/label.js
git -C "$REPO" -c user.name=Test -c user.email=test@example.com commit -qm frontend
FRONTEND=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" tag v0.0.1
bash "$REPO/deploy/scripts/validate-fast-release.sh" "$BASE" "$FRONTEND" v0.0.1 >/dev/null

if bash "$REPO/deploy/scripts/validate-fast-release.sh" "$BASE" "$BASE" v0.0.0 >/dev/null 2>&1; then
    echo "Fast release accepted an empty diff." >&2
    exit 1
fi
if bash "$REPO/deploy/scripts/validate-fast-release.sh" "$BASE" "$FRONTEND" v0.0.2 >/dev/null 2>&1; then
    echo "Fast release accepted a missing tag." >&2
    exit 1
fi

mkdir -p "$REPO/backend"
printf 'changed\n' > "$REPO/backend/settings.py"
git -C "$REPO" add backend/settings.py
git -C "$REPO" -c user.name=Test -c user.email=test@example.com commit -qm backend
BACKEND=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" tag v0.0.2
if bash "$REPO/deploy/scripts/validate-fast-release.sh" "$BASE" "$BACKEND" v0.0.2 >/dev/null 2>&1; then
    echo "Fast release accepted a backend change." >&2
    exit 1
fi
if bash "$REPO/deploy/scripts/validate-fast-release.sh" "$BACKEND" "$FRONTEND" v0.0.1 >/dev/null 2>&1; then
    echo "Fast release accepted a non-ancestor production base." >&2
    exit 1
fi

echo "Fast release diff guard tests passed."
