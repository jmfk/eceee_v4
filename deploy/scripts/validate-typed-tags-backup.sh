#!/usr/bin/env bash
# Validate a production backup in disposable local containers without exposing its contents.
# Usage: bash deploy/scripts/validate-typed-tags-backup.sh /absolute/path/eceee_v4_TIMESTAMP.sql.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "[backup-validation] Provide an existing .sql.gz backup file." >&2
    exit 2
fi

case "$BACKUP_FILE" in
    /*) ;;
    *) BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")" ;;
esac

if ! python3 - "$BACKUP_FILE" <<'PY'
import os
import sys

sys.exit(0 if os.stat(sys.argv[1]).st_mode & 0o077 == 0 else 1)
PY
then
    echo "[backup-validation] Backup must not be accessible by group or other users (use chmod 600)." >&2
    exit 2
fi

echo "[backup-validation] Checking compressed backup integrity without reading it into output..."
gzip -t "$BACKUP_FILE"

SUFFIX="$$"
NETWORK="eceee-typed-tags-validation-$SUFFIX"
DB_CONTAINER="eceee-typed-tags-db-$SUFFIX"
REDIS_CONTAINER="eceee-typed-tags-redis-$SUFFIX"
BACKEND_IMAGE="eceee-typed-tags-validation:$SUFFIX"

cleanup() {
    status=$?
    trap - EXIT
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
    docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
    docker image rm "$BACKEND_IMAGE" >/dev/null 2>&1 || true
    exit "$status"
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null
docker run -d --rm \
    --name "$DB_CONTAINER" \
    --network "$NETWORK" \
    -e POSTGRES_DB=eceee_v4 \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=test-only \
    postgres:15-alpine >/dev/null
docker run -d --rm \
    --name "$REDIS_CONTAINER" \
    --network "$NETWORK" \
    redis:7-alpine >/dev/null

echo "[backup-validation] Waiting for disposable PostgreSQL..."
for _ in $(seq 1 60); do
    if docker exec "$DB_CONTAINER" pg_isready -U postgres -d eceee_v4 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
if ! docker exec "$DB_CONTAINER" pg_isready -U postgres -d eceee_v4 >/dev/null 2>&1; then
    echo "[backup-validation] Disposable PostgreSQL did not become ready." >&2
    exit 1
fi

echo "[backup-validation] Restoring into the disposable database (dump output is suppressed)..."
if ! gzip -dc "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U postgres -d eceee_v4 >/dev/null 2>&1; then
    echo "[backup-validation] Restore failed; backup contents remain suppressed." >&2
    exit 1
fi

echo "[backup-validation] Building the exact local backend under review..."
docker build -q -t "$BACKEND_IMAGE" "$REPO/backend" >/dev/null

run_backend() {
    docker run --rm \
        --network "$NETWORK" \
        -e DJANGO_SETTINGS_MODULE=config.settings \
        -e DEBUG=0 \
        -e SECRET_KEY=local-backup-validation-secret-key-that-is-never-used-in-production \
        -e POSTGRES_DB=eceee_v4 \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=test-only \
        -e POSTGRES_HOST="$DB_CONTAINER" \
        -e POSTGRES_PORT=5432 \
        -e DATABASE_URL="postgresql://postgres:test-only@$DB_CONTAINER:5432/eceee_v4" \
        -e REDIS_URL="redis://$REDIS_CONTAINER:6379/0" \
        -e APP_VERSION=local-backup-validation \
        "$BACKEND_IMAGE" python manage.py "$@"
}

echo "[backup-validation] Applying current schema migrations..."
run_backend migrate --noinput

echo "[backup-validation] Running read-only source preflight..."
run_backend backfill_typed_tags --preflight-only

echo "[backup-validation] Exercising interruption and resume..."
run_backend backfill_typed_tags --run-id local-backup-validation --stop-after 1
run_backend backfill_typed_tags --run-id local-backup-validation
run_backend backfill_typed_tags --run-id local-backup-validation --verify-only
run_backend check

echo "[backup-validation] PASS: restore, migrations, preflight, resumable backfill, verification, and Django checks succeeded."
