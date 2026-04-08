#!/usr/bin/env bash
# backup.sh - Backup eceee_v4 production database
# Usage:
#   bash deploy/scripts/backup.sh            — create a backup
#   bash deploy/scripts/backup.sh restore FILE  — restore from a backup file
#
# Backups are stored in /mnt/data/backups/ (block storage, survives VPS rebuilds).
# Backups older than 30 days are automatically pruned.

set -euo pipefail

REPO=$(pwd)
ENV_FILE="$REPO/.env"
COMPOSE_FILE="$REPO/deploy/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
BACKUP_DIR=/mnt/data/backups

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[backup]${NC} $*"; }
success() { echo -e "${GREEN}[backup]${NC} $*"; }
error()   { echo -e "${RED}[backup]${NC} $*" >&2; }

# ── Restore mode ──────────────────────────────────────────────────────────────
if [ "${1:-}" = "restore" ]; then
    BACKUP_FILE="${2:-}"
    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        error "Usage: bash deploy/scripts/backup.sh restore /mnt/data/backups/eceee_v4_TIMESTAMP.sql.gz"
        exit 1
    fi

    info "Restoring from $BACKUP_FILE..."
    info "Stopping backend and celery workers..."
    $COMPOSE stop backend celery-worker celery-beat

    info "Dropping and recreating database..."
    $COMPOSE exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS eceee_v4;"
    $COMPOSE exec -T db psql -U postgres -c "CREATE DATABASE eceee_v4;"

    info "Restoring data..."
    gunzip -c "$BACKUP_FILE" | $COMPOSE exec -T db psql -U postgres eceee_v4

    info "Restarting services..."
    $COMPOSE up -d backend celery-worker celery-beat

    success "Restore complete from $BACKUP_FILE"
    exit 0
fi

# ── Backup mode ───────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="$BACKUP_DIR/eceee_v4_${TIMESTAMP}.sql.gz"

info "Backing up database to $OUTFILE..."
$COMPOSE exec -T db pg_dump -U postgres eceee_v4 | gzip > "$OUTFILE"

BACKUP_SIZE=$(du -sh "$OUTFILE" | cut -f1)
success "Backup complete: $OUTFILE ($BACKUP_SIZE)"

# Prune backups older than 30 days
PRUNED=$(find "$BACKUP_DIR" -name "eceee_v4_*.sql.gz" -mtime +30 -print -delete | wc -l)
if [ "$PRUNED" -gt 0 ]; then
    info "Pruned $PRUNED backup(s) older than 30 days."
fi
