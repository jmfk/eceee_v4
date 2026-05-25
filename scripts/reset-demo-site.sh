#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEMO_EXPORT="${DEMO_EXPORT:-demo/summerstudy.eceee.org-20260525-181814-871e39ea.zip}"
DEMO_DB="${DEMO_DB:-eceee_demo}"
DEMO_BACKEND_PORT="${DEMO_BACKEND_PORT:-8000}"
DEMO_FRONTEND_PORT="${DEMO_FRONTEND_PORT:-3000}"
DEMO_HOSTNAMES="${DEMO_HOSTNAMES:-localhost,127.0.0.1}"
DEMO_TENANT_IDENTIFIER="${DEMO_TENANT_IDENTIFIER:-demo}"
DEMO_TENANT_NAME="${DEMO_TENANT_NAME:-Demo Site}"
DEMO_NAMESPACE_SLUG="${DEMO_NAMESPACE_SLUG:-demo}"
DEMO_NAMESPACE_NAME="${DEMO_NAMESPACE_NAME:-Demo}"
DEMO_USER="${DEMO_USER:-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo}"
START_DEMO_SITE="${START_DEMO_SITE:-0}"

if [[ ! "$DEMO_DB" =~ ^eceee_demo[[:alnum:]_]*$ ]]; then
  echo "Refusing to reset database '$DEMO_DB'. Demo DB names must start with eceee_demo." >&2
  exit 1
fi

if [[ ! -f "$DEMO_EXPORT" ]]; then
  echo "Demo export not found: $DEMO_EXPORT" >&2
  exit 1
fi

EXPORT_ABS="$(cd "$(dirname "$DEMO_EXPORT")" && pwd)/$(basename "$DEMO_EXPORT")"

echo "Starting shared infrastructure..."
docker-compose -f docker-compose.infra.yml up -d

echo "Waiting for Postgres..."
for _ in $(seq 1 60); do
  if docker-compose -f docker-compose.infra.yml exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Stopping app containers before resetting '$DEMO_DB'..."
docker-compose -f docker-compose.dev.yml stop backend frontend celery-worker >/dev/null 2>&1 || true

echo "Resetting database '$DEMO_DB'..."
docker-compose -f docker-compose.infra.yml exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS "$DEMO_DB" WITH (FORCE);
CREATE DATABASE "$DEMO_DB";
SQL

echo "Writing local demo settings to .env..."
DEMO_DB="$DEMO_DB" \
DEMO_BACKEND_PORT="$DEMO_BACKEND_PORT" \
DEMO_FRONTEND_PORT="$DEMO_FRONTEND_PORT" \
python3 - <<'PY'
from pathlib import Path
import os

env_path = Path(".env")
values = {
    "POSTGRES_DB": os.environ["DEMO_DB"],
    "POSTGRES_HOST": "eceee-v4-db",
    "DATABASE_URL": f"postgresql://postgres:postgres@eceee-v4-db:5432/{os.environ['DEMO_DB']}",
    "BACKEND_PORT": os.environ["DEMO_BACKEND_PORT"],
    "FRONTEND_PORT": os.environ["DEMO_FRONTEND_PORT"],
    "REACT_APP_API_URL": f"http://localhost:{os.environ['DEMO_BACKEND_PORT']}/api",
    "REACT_APP_BACKEND_URL": f"http://localhost:{os.environ['DEMO_BACKEND_PORT']}",
    "VITE_WS_URL": f"ws://localhost:{os.environ['DEMO_BACKEND_PORT']}",
    "VITE_BACKEND_URL": "http://backend:8000",
    "VITE_IMGPROXY_URL": "http://localhost:8080",
    "CORS_ALLOWED_ORIGINS": (
        f"http://localhost:{os.environ['DEMO_FRONTEND_PORT']},"
        f"http://127.0.0.1:{os.environ['DEMO_FRONTEND_PORT']}"
    ),
    "ALLOWED_HOSTS": "localhost,127.0.0.1,backend,frontend,testserver",
}

lines = env_path.read_text().splitlines() if env_path.exists() else []
seen = set()
updated = []

for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        updated.append(line)
        continue
    key = line.split("=", 1)[0]
    if key in values:
        updated.append(f"{key}={values[key]}")
        seen.add(key)
    else:
        updated.append(line)

for key, value in values.items():
    if key not in seen:
        updated.append(f"{key}={value}")

env_path.write_text("\n".join(updated) + "\n")
PY

export POSTGRES_DB="$DEMO_DB"
export DATABASE_URL="postgresql://postgres:postgres@eceee-v4-db:5432/$DEMO_DB"
export POSTGRES_HOST="eceee-v4-db"
export BACKEND_PORT="$DEMO_BACKEND_PORT"
export FRONTEND_PORT="$DEMO_FRONTEND_PORT"
export REACT_APP_API_URL="http://localhost:$DEMO_BACKEND_PORT/api"
export REACT_APP_BACKEND_URL="http://localhost:$DEMO_BACKEND_PORT"
export VITE_WS_URL="ws://localhost:$DEMO_BACKEND_PORT"
export VITE_BACKEND_URL="http://backend:8000"
export VITE_IMGPROXY_URL="http://localhost:8080"

echo "Running migrations in '$DEMO_DB'..."
docker-compose -f docker-compose.dev.yml run --rm -T backend python manage.py migrate

echo "Importing site package..."
docker-compose -f docker-compose.dev.yml run --rm -T \
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
  docker-compose -f docker-compose.dev.yml run --rm -T \
    -e POSTGRES_DB="$DEMO_DB" \
    -e DATABASE_URL="postgresql://postgres:postgres@eceee-v4-db:5432/$DEMO_DB" \
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
    docker-compose -f docker-compose.dev.yml up backend frontend
fi
