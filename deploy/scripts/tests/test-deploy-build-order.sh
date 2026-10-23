#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/../deploy.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eceee-deploy-build-test.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT

awk '/^build_images_serially\(\)/,/^}/' "$DEPLOY_SCRIPT" > "$TEST_DIR/build-images-function.sh"
# shellcheck source=/dev/null
source "$TEST_DIR/build-images-function.sh"

info() {
    :
}

docker_compose() {
    printf '%s\n' "$*" >> "$TEST_DIR/compose-calls"
}

export IMAGE_TAG=test-image
build_images_serially backend frontend playwright publisher

cat > "$TEST_DIR/expected-calls" <<'EOF'
build backend
build frontend
build playwright
build publisher
EOF

cmp "$TEST_DIR/expected-calls" "$TEST_DIR/compose-calls"
echo "deploy image serialization test passed"

# Release labels must identify the exact deployed commit, never its nearest tag.
awk '/^resolve_release_tag\(\)/,/^}/' "$DEPLOY_SCRIPT" > "$TEST_DIR/release-tag-function.sh"
source "$TEST_DIR/release-tag-function.sh"
git init -q "$TEST_DIR/repo"
git -C "$TEST_DIR/repo" -c user.name=Test -c user.email=test@example.invalid commit --allow-empty -qm tagged
git -C "$TEST_DIR/repo" tag v1.2.3
[ "$(resolve_release_tag "$TEST_DIR/repo" HEAD)" = v1.2.3 ]
git -C "$TEST_DIR/repo" -c user.name=Test -c user.email=test@example.invalid commit --allow-empty -qm untagged
[ -z "$(resolve_release_tag "$TEST_DIR/repo" HEAD)" ]
echo "exact release tag metadata test passed"

bash "$SCRIPT_DIR/test-deploy-migration-order.sh"
