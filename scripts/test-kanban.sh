#!/usr/bin/env bash
# Local disposable PostgreSQL tests. No host ports, secrets or shared-provider mutations.
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
image="${ECEEE_KANBAN_TEST_IMAGE:-eceee-v4-backend-editor:latest}"
run_name="eceee-kanban-test-$$"
docker_cmd=(docker --context orbstack)
"${docker_cmd[@]}" image inspect "$image" --format '{{.Id}}' >/dev/null
cleanup() {
    "${docker_cmd[@]}" rm -f "$run_name-db" >/dev/null 2>&1 || true
    "${docker_cmd[@]}" network rm "$run_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"${docker_cmd[@]}" network create --internal "$run_name" >/dev/null
"${docker_cmd[@]}" run -d --name "$run_name-db" --network "$run_name" --network-alias kanban-db \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=kanban_test postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
    if "${docker_cmd[@]}" exec "$run_name-db" pg_isready -U postgres -d kanban_test >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
done
if [[ "$ready" != true ]]; then echo 'Disposable Kanban PostgreSQL did not become ready.' >&2; exit 1; fi
if [[ $# == 0 ]]; then
    set -- kanban \
        core.tests.MachineAPIKeyAuthenticationTest.test_supported_cms_routes_have_resource_specific_scopes \
        core.tests.MachineAPIKeyAuthenticationTest.test_theme_subroutes_have_stable_specific_scopes
fi
"${docker_cmd[@]}" run --rm --network "$run_name" -v "$repo_root/backend:/app" -w /app \
    --entrypoint python "$image" manage.py test "$@" --settings=config.settings_kanban_test --noinput --verbosity=1
