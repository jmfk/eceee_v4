#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEMO_EXPORT="${DEMO_EXPORT:-demo/summerstudy.eceee.org-20260525-181814-871e39ea.zip}"
DEMO_DB="${DEMO_DB:-eceee_demo}"
DEMO_BACKEND_PORT="${DEMO_BACKEND_PORT:-10101}"
DEMO_FRONTEND_PORT="${DEMO_FRONTEND_PORT:-10100}"
DEMO_HOSTNAMES="${DEMO_HOSTNAMES:-localhost,127.0.0.1}"
DEMO_TENANT_IDENTIFIER="${DEMO_TENANT_IDENTIFIER:-demo}"
DEMO_TENANT_NAME="${DEMO_TENANT_NAME:-Demo Site}"
DEMO_NAMESPACE_SLUG="${DEMO_NAMESPACE_SLUG:-demo}"
DEMO_NAMESPACE_NAME="${DEMO_NAMESPACE_NAME:-Demo}"
DEMO_USER="${DEMO_USER:-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo}"
START_DEMO_SITE="${START_DEMO_SITE:-0}"

if [[ "$DEMO_DB" != "eceee_demo" ]]; then
  echo "The shared provider admits only the explicitly disposable database 'eceee_demo'." >&2
  exit 1
fi

if [[ ! -f "$DEMO_EXPORT" ]]; then
  echo "Demo export not found: $DEMO_EXPORT" >&2
  exit 1
fi

EXPORT_ABS="$(cd "$(dirname "$DEMO_EXPORT")" && pwd)/$(basename "$DEMO_EXPORT")"

echo "Stopping app containers before resetting '$DEMO_DB'..."
docker compose -f docker-compose.dev.yml stop backend frontend celery-worker >/dev/null 2>&1 || true

echo "Resetting only the provider-admitted disposable demo database..."
make -C ../shared-local-infrastructure reset-eceee-demo CONFIRM=RESET_ONLY_ECEEE_DEMO

echo "Writing local demo settings to .env..."
python3 scripts/configure_orbstack.py \
  --demo \
  --backend-port "$DEMO_BACKEND_PORT" \
  --frontend-port "$DEMO_FRONTEND_PORT"

# The parent Make process may have exported the previous .env values. Remove
# service configuration from this shell so Compose reloads the newly written
# demo identity without exposing credential values.
unset DATABASE_URL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_HOST POSTGRES_PORT
unset REDIS_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_STORAGE_BUCKET_NAME
unset AWS_S3_ENDPOINT_URL AWS_S3_INTERNAL_ENDPOINT_URL
export BACKEND_PORT="$DEMO_BACKEND_PORT"
export FRONTEND_PORT="$DEMO_FRONTEND_PORT"
export REACT_APP_API_URL="http://localhost:$DEMO_BACKEND_PORT/api"
export REACT_APP_BACKEND_URL="http://localhost:$DEMO_BACKEND_PORT"
export VITE_WS_URL="ws://localhost:$DEMO_BACKEND_PORT"
export VITE_BACKEND_URL="http://backend:8000"
export VITE_IMGPROXY_URL="http://localhost:10106"

echo "Running migrations in '$DEMO_DB'..."
docker compose -f docker-compose.dev.yml run --rm -T backend python manage.py migrate

echo "Importing site package..."
docker compose -f docker-compose.dev.yml run --rm -T \
  --volume "$EXPORT_ABS:/tmp/site-package.zip:ro" \
  backend python manage.py import_site_package /tmp/site-package.zip \
  --username "$DEMO_USER" \
  --password "$DEMO_PASSWORD" \
  --tenant-identifier "$DEMO_TENANT_IDENTIFIER" \
  --tenant-name "$DEMO_TENANT_NAME" \
  --namespace-slug "$DEMO_NAMESPACE_SLUG" \
  --namespace-name "$DEMO_NAMESPACE_NAME" \
  --hostnames "$DEMO_HOSTNAMES"

echo "Setting demo tenant as the default request tenant..."
DEMO_TENANT_ID="$(
  docker compose -f docker-compose.dev.yml run --rm -T \
    backend python manage.py shell -c "from core.models import Tenant; print(Tenant.objects.get(identifier='$DEMO_TENANT_IDENTIFIER').id)"
)"
DEMO_TENANT_ID="$(printf "%s\n" "$DEMO_TENANT_ID" | tail -n 1 | tr -d '\r')"
export DEFAULT_TENANT_ID="$DEMO_TENANT_ID"

DEFAULT_TENANT_ID="$DEMO_TENANT_ID" python3 - <<'PY'
from pathlib import Path
import os

env_path = Path(".env")
lines = env_path.read_text().splitlines() if env_path.exists() else []
updated = []
seen = False

for line in lines:
    if line.startswith("DEFAULT_TENANT_ID="):
        updated.append(f"DEFAULT_TENANT_ID={os.environ['DEFAULT_TENANT_ID']}")
        seen = True
    else:
        updated.append(line)

if not seen:
    updated.append(f"DEFAULT_TENANT_ID={os.environ['DEFAULT_TENANT_ID']}")

env_path.write_text("\n".join(updated) + "\n")
PY

echo "Demo site reset complete."
echo "Frontend: http://localhost:$DEMO_FRONTEND_PORT/"
echo "Backend/public site: http://localhost:$DEMO_BACKEND_PORT/"
echo "Login: $DEMO_USER / $DEMO_PASSWORD"
echo "Default tenant: $DEMO_TENANT_IDENTIFIER ($DEMO_TENANT_ID)"

if [[ "$START_DEMO_SITE" == "1" ]]; then
  echo "Starting local demo app..."
  VITE_GIT_COMMIT_HASH="$(git rev-parse --short HEAD)" \
    docker compose -f docker-compose.dev.yml up backend frontend
fi
