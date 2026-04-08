#!/usr/bin/env bash
# rollback.sh - Rollback eceee_v4 to the previous deployment
# Usage: bash deploy/scripts/rollback.sh [TAG]
#   TAG: specific tag to roll back to (default: previous tag from deploy.log)
#
# NOTE: This rolls back application code only.
# If migrations need reverting, do it manually:
#   docker compose ... exec backend python manage.py migrate <app> <migration_number>
# For a full DB restore, use the backup file created before the failed deploy:
#   bash deploy/scripts/backup.sh restore /mnt/data/backups/eceee_v4_TIMESTAMP.sql.gz

set -euo pipefail

REPO=$(pwd)
DEPLOY_LOG="$REPO/deploy.log"
SCRIPT_DIR="$REPO/deploy/scripts"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[rollback]${NC} $*"; }
success() { echo -e "${GREEN}[rollback]${NC} $*"; }
warn()    { echo -e "${YELLOW}[rollback]${NC} $*"; }
error()   { echo -e "${RED}[rollback]${NC} $*" >&2; }

# ── Determine rollback target ─────────────────────────────────────────────────
ROLLBACK_TAG="${1:-}"

if [ -z "$ROLLBACK_TAG" ]; then
    if [ ! -f "$DEPLOY_LOG" ]; then
        error "No deploy log found at $DEPLOY_LOG and no TAG specified."
        exit 1
    fi

    # Get the second-to-last successful deploy tag
    PREV_LINE=$(grep -v '^\[ROLLBACK\]' "$DEPLOY_LOG" | tail -n 2 | head -n 1)
    ROLLBACK_TAG=$(echo "$PREV_LINE" | awk '{print $1}')

    if [ -z "$ROLLBACK_TAG" ]; then
        error "Could not determine previous tag from $DEPLOY_LOG"
        error "Specify explicitly: bash deploy/scripts/rollback.sh v0.1.x"
        exit 1
    fi
fi

# Get current tag
CURRENT_TAG=$(grep -v '^\[ROLLBACK\]' "$DEPLOY_LOG" 2>/dev/null | tail -n 1 | awk '{print $1}' || echo "unknown")

info "Current deployment: $CURRENT_TAG"
info "Rolling back to:    $ROLLBACK_TAG"
echo

# ── Warn about migration mismatch ─────────────────────────────────────────────
warn "NOTE: This rollback does NOT automatically revert database migrations."
warn "If the failed deployment added new migrations, run them manually if needed."
warn "For a full DB restore: see deploy/README.md#database-restore"
echo

# ── Execute rollback via deploy.sh ────────────────────────────────────────────
info "Calling deploy.sh with $ROLLBACK_TAG..."
bash "$SCRIPT_DIR/deploy.sh" "$ROLLBACK_TAG"

# Record rollback in deploy log
echo "[ROLLBACK] from $CURRENT_TAG to $ROLLBACK_TAG $(date '+%Y-%m-%d %H:%M:%S')" >> "$DEPLOY_LOG"
success "Rollback to $ROLLBACK_TAG complete."
