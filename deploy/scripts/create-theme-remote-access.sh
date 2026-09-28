#!/usr/bin/env bash
# Create or rotate the production access key used by local Designer theme sync.
# Usage: THEME_WORKSPACE=workspace THEME_ADMIN=username make prod-theme-access-key

set -euo pipefail

PROD_HOST="${1:-root@eceee-vps}"
PROD_DIR="${2:-/srv/eceee_v4}"
THEME_WORKSPACE="${THEME_WORKSPACE:-}"
THEME_ADMIN="${THEME_ADMIN:-}"

if [[ ! "$THEME_WORKSPACE" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
    echo "[theme-access] THEME_WORKSPACE must be a lowercase workspace identifier." >&2
    exit 2
fi
if [ "${#THEME_WORKSPACE}" -gt 100 ]; then
    echo "[theme-access] THEME_WORKSPACE must be at most 100 characters." >&2
    exit 2
fi
if [[ ! "$THEME_ADMIN" =~ ^[A-Za-z0-9@.+_-]+$ ]]; then
    echo "[theme-access] THEME_ADMIN contains unsupported characters." >&2
    exit 2
fi
if [ "${#THEME_ADMIN}" -gt 150 ]; then
    echo "[theme-access] THEME_ADMIN must be at most 150 characters." >&2
    exit 2
fi

if [ "${THEME_ACCESS_CONFIRM:-}" != "yes" ]; then
    echo "This creates or rotates the production theme-sync key named 'Local development'."
    echo "Any previous key with that name will stop working."
    read -r -p "Type yes to continue: " answer
    if [ "$answer" != "yes" ]; then
        echo "[theme-access] Cancelled."
        exit 1
    fi
fi

echo "[theme-access] Creating a key for workspace '$THEME_WORKSPACE'..."
echo "[theme-access] The final output line is secret. Copy it directly to the local Designer form."

printf -v remote_command 'bash -s -- %q %q %q' "$PROD_DIR" "$THEME_WORKSPACE" "$THEME_ADMIN"
# The three client-side values are shell-escaped with printf %q above.
# shellcheck disable=SC2029
ssh "$PROD_HOST" "$remote_command" <<'REMOTE_SCRIPT'
set -euo pipefail

PROD_DIR="$1"
THEME_WORKSPACE="$2"
THEME_ADMIN="$3"
LOCK_FILE="/mnt/data/.eceee-production-operation.lock"

cd "$PROD_DIR"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[theme-access] Another production operation is running." >&2
    exit 1
fi

compose=(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env)

if ! "${compose[@]}" exec -T backend python manage.py shell -c \
    'from django.conf import settings; raise SystemExit(0 if settings.THEME_SYNC_ENABLED else 1)'
then
    echo "[theme-access] Theme sync is disabled in production." >&2
    echo "[theme-access] Set THEME_SYNC_ENABLED=True in deploy/.env and run make prod-restart first." >&2
    exit 1
fi

"${compose[@]}" exec -T backend python manage.py setup_theme_remote_access \
    --workspace "$THEME_WORKSPACE" \
    --created-by "$THEME_ADMIN" \
    --name "Local development"
REMOTE_SCRIPT
