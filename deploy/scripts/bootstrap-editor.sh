#!/usr/bin/env bash
# Install only the reviewed CMS frontend so root hostname aliases can be entered
# before the full publisher deployment. Run locally via make prod-bootstrap-editor.
set -euo pipefail

if [ "${1:-}" != "--remote" ]; then
    HOST="${1:?Production SSH host is required}"
    REMOTE_REPO="${2:?Production repository path is required}"
    TARGET="${3:?Full target commit is required}"
    [[ "$REMOTE_REPO" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo "Invalid production path" >&2; exit 2; }
    [[ "$TARGET" =~ ^[0-9a-f]{40}$ ]] || { echo "A full commit SHA is required" >&2; exit 2; }
    # Validated path and hex SHA are intentionally interpolated in the remote command.
    # shellcheck disable=SC2029
    ssh "$HOST" "bash -s -- --remote '$REMOTE_REPO' '$TARGET'" < "$0"
    exit
fi

REMOTE_REPO="${2:?Production repository path is required}"
TARGET="${3:?Full target commit is required}"
[[ "$REMOTE_REPO" =~ ^/[a-zA-Z0-9_./-]+$ && "$TARGET" =~ ^[0-9a-f]{40}$ ]] || exit 2
SCRIPT_DIR="$REMOTE_REPO/deploy/scripts"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"
[[ "$REPO" == "$REMOTE_REPO" && -f "$ENV_FILE" ]] || { echo "Production repository or environment missing" >&2; exit 1; }
cd "$DEPLOY_DIR"
acquire_production_operation_lock "editor-bootstrap"

git -C "$REPO" fetch origin main --quiet
git -C "$REPO" merge-base --is-ancestor "$TARGET" origin/main || {
    echo "Target must be a commit on origin/main" >&2
    exit 1
}
SHORT_TAG=$(git -C "$REPO" rev-parse --short "$TARGET")
CURRENT_ID=$(docker_compose ps -q frontend)
[[ -n "$CURRENT_ID" ]] || { echo "Frontend container is not running" >&2; exit 1; }
PREVIOUS_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$CURRENT_ID")
[[ "$PREVIOUS_IMAGE" =~ ^eceee-frontend:[a-zA-Z0-9_.-]+$ ]] || {
    echo "Unexpected current frontend image; refusing bootstrap" >&2
    exit 1
}
[[ -n "${DOMAIN:-}" ]] || { echo "DOMAIN is missing" >&2; exit 1; }

BUILD_DIR=$(mktemp -d /tmp/eceee-editor-bootstrap.XXXXXXXX)
WORKTREE_CREATED=0
SWITCHED=0
SUCCEEDED=0
# shellcheck disable=SC2329
cleanup() {
    result=$?
    trap - EXIT
    if [ "$SWITCHED" -eq 1 ] && [ "$SUCCEEDED" -eq 0 ]; then
        echo "Frontend check failed; restoring $PREVIOUS_IMAGE" >&2
        IMAGE_TAG="${PREVIOUS_IMAGE#eceee-frontend:}" docker_compose up -d --no-deps --no-build frontend || true
    fi
    if [ "$WORKTREE_CREATED" -eq 1 ]; then
        git -C "$REPO" worktree remove --force "$BUILD_DIR" || true
    fi
    rmdir "$BUILD_DIR" 2>/dev/null || true
    exit "$result"
}
trap cleanup EXIT

git -C "$REPO" worktree add --quiet --detach "$BUILD_DIR" "$TARGET"
WORKTREE_CREATED=1
echo "Building frontend from $TARGET"
docker build --target production \
    --build-arg "VITE_API_URL=https://${DOMAIN}/api" \
    --build-arg "VITE_IMGPROXY_URL=https://imgproxy.${DOMAIN}" \
    --build-arg "VITE_GIT_COMMIT_HASH=$SHORT_TAG" \
    --tag "eceee-frontend:$SHORT_TAG" \
    "$BUILD_DIR/frontend"

echo "Updating frontend only; backend, publisher, database and checkout stay unchanged"
SWITCHED=1
IMAGE_TAG="$SHORT_TAG" docker_compose up -d --no-deps --no-build frontend
for attempt in {1..30}; do
    CURRENT_ID=$(docker_compose ps -q frontend)
    if [ -n "$CURRENT_ID" ] && [ "$(docker inspect --format '{{.State.Health.Status}}' "$CURRENT_ID")" = healthy ]; then
        RUNNING_IMAGE=$(docker inspect --format '{{.Image}}' "$CURRENT_ID")
        TARGET_IMAGE=$(docker image inspect --format '{{.Id}}' "eceee-frontend:$SHORT_TAG")
        if [ "$RUNNING_IMAGE" = "$TARGET_IMAGE" ]; then
            SUCCEEDED=1
            echo "CMS frontend healthy at $TARGET ($SHORT_TAG). Add the three root aliases, then run the full deploy."
            exit 0
        fi
    fi
    echo "Waiting for frontend health ($attempt/30)"
    sleep 3
done
echo "New frontend did not become healthy" >&2
exit 1
