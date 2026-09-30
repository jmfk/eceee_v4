#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$(cd "$SCRIPT_DIR/.." && pwd)/validate-deploy-control-ref.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_REPO=$(mktemp -d)
trap 'rm -rf "$TEST_REPO"' EXIT

if ! grep -Fxq '**/.env*' "$REPO_ROOT/.dockerignore"; then
    echo "repository Docker context does not exclude environment files" >&2
    exit 1
fi

git -C "$TEST_REPO" init --quiet --initial-branch=main
git -C "$TEST_REPO" config user.email test@example.com
git -C "$TEST_REPO" config user.name "Deploy Control Test"
mkdir -p "$TEST_REPO/deploy/scripts"
printf '**/.env*\n' > "$TEST_REPO/.dockerignore"
printf 'v1\n' > "$TEST_REPO/deploy/Caddyfile"
printf 'v1\n' > "$TEST_REPO/deploy/docker-compose.prod.yml"
printf '#!/usr/bin/env bash\n' > "$TEST_REPO/deploy/scripts/deploy.sh"
git -C "$TEST_REPO" add .dockerignore deploy
git -C "$TEST_REPO" commit --quiet -m base
BASE_COMMIT=$(git -C "$TEST_REPO" rev-parse HEAD)

git -C "$TEST_REPO" switch --quiet -c app-target
printf 'application change\n' > "$TEST_REPO/application.txt"
git -C "$TEST_REPO" add application.txt
git -C "$TEST_REPO" commit --quiet -m application
APP_COMMIT=$(git -C "$TEST_REPO" rev-parse HEAD)

git -C "$TEST_REPO" switch --quiet main
printf 'v2 from main\n' > "$TEST_REPO/deploy/Caddyfile"
git -C "$TEST_REPO" add deploy/Caddyfile
git -C "$TEST_REPO" commit --quiet -m "main control update"
git -C "$TEST_REPO" update-ref refs/remotes/origin/main HEAD

resolved=$(bash "$VALIDATOR" "$TEST_REPO" "$APP_COMMIT")
[ "$resolved" = "$APP_COMMIT" ]

resolved=$(bash "$VALIDATOR" "$TEST_REPO" "$BASE_COMMIT")
[ "$resolved" = "$BASE_COMMIT" ]

git -C "$TEST_REPO" switch --quiet -c control-target "$APP_COMMIT"
printf 'branch-only control change\n' > "$TEST_REPO/deploy/Caddyfile"
git -C "$TEST_REPO" add deploy/Caddyfile
git -C "$TEST_REPO" commit --quiet -m "unmerged control update"
CONTROL_COMMIT=$(git -C "$TEST_REPO" rev-parse HEAD)

if bash "$VALIDATOR" "$TEST_REPO" "$CONTROL_COMMIT" >/dev/null 2>&1; then
    echo "validator unexpectedly accepted an unmerged deployment-control change" >&2
    exit 1
fi

git -C "$TEST_REPO" switch --quiet -c dockerignore-target "$APP_COMMIT"
printf '# branch removed the production secret boundary\n' > "$TEST_REPO/.dockerignore"
git -C "$TEST_REPO" add .dockerignore
git -C "$TEST_REPO" commit --quiet -m "unmerged dockerignore update"
DOCKERIGNORE_COMMIT=$(git -C "$TEST_REPO" rev-parse HEAD)

if bash "$VALIDATOR" "$TEST_REPO" "$DOCKERIGNORE_COMMIT" >/dev/null 2>&1; then
    echo "validator unexpectedly accepted an unmerged Docker ignore boundary change" >&2
    exit 1
fi

echo "deploy-control validator tests passed"
