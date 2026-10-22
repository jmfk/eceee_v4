#!/usr/bin/env bash
# reconcile-classifications.sh - Run the one-time classification production backfill safely.
# Usage: bash deploy/scripts/reconcile-classifications.sh [RUN_ID] [CANARY_SIZE]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/env.sh
source "$SCRIPT_DIR/env.sh"
cd "$DEPLOY_DIR" || exit 1

RUN_ID="${1:-classification-reconcile-v1}"
CANARY_SIZE="${2:-100}"

if [[ ! "$RUN_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "[classifications] RUN_ID must contain only letters, numbers, underscores, and hyphens." >&2
    exit 2
fi
if [ "${#RUN_ID}" -gt 100 ]; then
    echo "[classifications] RUN_ID must be at most 100 characters." >&2
    exit 2
fi
if [[ ! "$CANARY_SIZE" =~ ^[1-9][0-9]*$ ]]; then
    echo "[classifications] CANARY_SIZE must be a positive integer." >&2
    exit 2
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "[classifications] Missing $ENV_FILE." >&2
    exit 1
fi

acquire_production_operation_lock "classifications"

DEPLOYED_VERSION=$(
    docker_compose exec -T backend python -c \
        'import os; value = os.environ.get("APP_VERSION", ""); print(value if value != "unknown" else "")'
)
if [ -z "$DEPLOYED_VERSION" ]; then
    echo "[classifications] Could not determine a non-unknown APP_VERSION from the running backend." >&2
    exit 1
fi

maintenance_started=false
verify_application_services() {
    local service
    for service in backend celery-worker celery-beat; do
        if ! docker_compose ps --status running --services "$service" | grep -Fxq "$service"; then
            echo "[classifications] Application service $service is not running." >&2
            return 1
        fi
    done
}

restore_services() {
    status=$?
    trap - EXIT
    if [ "$maintenance_started" = true ]; then
        echo "[classifications] Restoring application services..."
        if ! IMAGE_TAG="$DEPLOYED_VERSION" docker_compose up -d backend celery-worker celery-beat; then
            echo "[classifications] RECOVERY FAILED: application services could not be restarted." >&2
            exit 70
        fi
        if ! bash "$SCRIPT_DIR/healthcheck.sh"; then
            echo "[classifications] RECOVERY FAILED: application services restarted but did not become healthy." >&2
            exit 70
        fi
        if ! verify_application_services; then
            echo "[classifications] RECOVERY FAILED: one or more application services did not stay running." >&2
            exit 70
        fi
    fi
    exit "$status"
}
trap restore_services EXIT

run_backend() {
    IMAGE_TAG="$DEPLOYED_VERSION" docker_compose run --rm -T backend python manage.py "$@"
}

echo "[classifications] Entering maintenance mode for deployed version $DEPLOYED_VERSION..."
# Compose may stop only part of the service set before returning an error or
# receiving an interrupt, so arm EXIT recovery before shutdown begins.
maintenance_started=true
docker_compose stop backend celery-worker celery-beat

echo "[classifications] Creating mandatory maintenance-window backup..."
bash "$SCRIPT_DIR/backup.sh"

echo "[classifications] Confirming that the deployed schema is current..."
run_backend migrate --check

echo "[classifications] A verified backfill_typed_tags run is required before this expansion."
echo "[classifications] Running read-only source preflight..."
run_backend reconcile_classifications --preflight-only

echo "[classifications] Running bounded canary ($CANARY_SIZE work units)..."
run_backend reconcile_classifications --run-id "$RUN_ID" --stop-after "$CANARY_SIZE"

echo "[classifications] Completing or resuming the immutable run..."
run_backend reconcile_classifications --run-id "$RUN_ID"

echo "[classifications] Verifying canonical relations independently..."
run_backend reconcile_classifications --run-id "$RUN_ID" --verify-only

echo "[classifications] Restarting application services..."
IMAGE_TAG="$DEPLOYED_VERSION" docker_compose up -d backend celery-worker celery-beat

echo "[classifications] Waiting for application health..."
bash "$SCRIPT_DIR/healthcheck.sh"
verify_application_services
maintenance_started=false

echo "$RUN_ID ($DEPLOYED_VERSION) $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPO/classification-backfill.log"
trap - EXIT
echo "[classifications] Backfill $RUN_ID completed and verified successfully."

echo "[classifications] Activation is separate: run classification_cutover readiness per namespace, then request the explicit activation gate."
