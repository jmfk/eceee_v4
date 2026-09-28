#!/usr/bin/env bash
# Create a fresh production backup, fetch that exact file, and validate it locally.
# Usage: bash deploy/scripts/fetch-and-validate-typed-tags-backup.sh PROD_HOST PROD_DIR

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROD_HOST="${1:-}"
PROD_DIR="${2:-}"
KEEP_BACKUP="${KEEP_BACKUP:-0}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$REPO/storage/production-backups}"
VALIDATOR="${TYPED_TAG_BACKUP_VALIDATOR:-$SCRIPT_DIR/validate-typed-tags-backup.sh}"
REMOTE_BACKUP_DIR=/mnt/data/backups

fail() {
    echo "[backup-validation] $*" >&2
    exit 2
}

case "$PROD_HOST" in
    ""|-*|*[!A-Za-z0-9_.:@-]*) fail "PROD_HOST contains unsupported characters." ;;
esac
case "$PROD_DIR" in
    /*) ;;
    *) fail "PROD_DIR must be an absolute path." ;;
esac
case "$PROD_DIR" in
    *[!A-Za-z0-9_./-]*) fail "PROD_DIR contains unsupported characters." ;;
esac
case "$KEEP_BACKUP" in
    0|1) ;;
    *) fail "KEEP_BACKUP must be 0 or 1." ;;
esac

for command_name in ssh scp gzip python3; do
    command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required."
done
[ -x "$VALIDATOR" ] || fail "Typed-tag backup validator is not executable: $VALIDATOR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eceee-typed-tags-backup.XXXXXX")"
chmod 700 "$WORK_DIR"
LOCAL_BACKUP=""

cleanup() {
    status=$?
    trap - EXIT
    if [ -n "$LOCAL_BACKUP" ]; then
        rm -f -- "$LOCAL_BACKUP"
    fi
    rmdir "$WORK_DIR" >/dev/null 2>&1 || true
    exit "$status"
}
trap cleanup EXIT

echo "[backup-validation] Creating a fresh production backup..."
# The restricted path character set above makes this remote command unambiguous.
# shellcheck disable=SC2029
REMOTE_BACKUP_NAME="$(ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/backup.sh --print-basename")"
if [[ ! "$REMOTE_BACKUP_NAME" =~ ^eceee_v4_[0-9]{8}_[0-9]{6}_[0-9]+\.sql\.gz$ ]]; then
    fail "Production backup did not return one valid backup basename."
fi

REMOTE_BACKUP="$REMOTE_BACKUP_DIR/$REMOTE_BACKUP_NAME"
LOCAL_BACKUP="$WORK_DIR/$REMOTE_BACKUP_NAME"

echo "[backup-validation] Fetching the new backup through SSH..."
scp "$PROD_HOST:$REMOTE_BACKUP" "$LOCAL_BACKUP" >/dev/null
chmod 600 "$LOCAL_BACKUP"
[ -f "$LOCAL_BACKUP" ] && [ ! -L "$LOCAL_BACKUP" ] || fail "Fetched backup is not a regular file."

echo "[backup-validation] Comparing transfer checksums without displaying them..."
# shellcheck disable=SC2029
REMOTE_CHECKSUM="$(ssh "$PROD_HOST" "sha256sum '$REMOTE_BACKUP' | cut -d ' ' -f1")"
LOCAL_CHECKSUM="$(python3 - "$LOCAL_BACKUP" <<'PY'
import hashlib
import sys

digest = hashlib.sha256()
with open(sys.argv[1], "rb") as backup:
    for chunk in iter(lambda: backup.read(1024 * 1024), b""):
        digest.update(chunk)
print(digest.hexdigest())
PY
)"
case "$REMOTE_CHECKSUM" in
    ""|*[!0-9a-fA-F]*) fail "Production backup checksum was invalid." ;;
esac
[ "${#REMOTE_CHECKSUM}" -eq 64 ] || fail "Production backup checksum was invalid."
[ "$REMOTE_CHECKSUM" = "$LOCAL_CHECKSUM" ] || fail "Transferred backup failed its integrity comparison."
gzip -t "$LOCAL_BACKUP"

echo "[backup-validation] Running the isolated local typed-tag validation..."
DOCKER_CONTEXT="${DOCKER_CONTEXT:-orbstack}" "$VALIDATOR" "$LOCAL_BACKUP"

if [ "$KEEP_BACKUP" = "1" ]; then
    mkdir -p "$LOCAL_BACKUP_DIR"
    chmod 700 "$LOCAL_BACKUP_DIR"
    PRESERVED_BACKUP="$LOCAL_BACKUP_DIR/$REMOTE_BACKUP_NAME"
    [ ! -e "$PRESERVED_BACKUP" ] || fail "Refusing to overwrite existing backup: $PRESERVED_BACKUP"
    mv "$LOCAL_BACKUP" "$PRESERVED_BACKUP"
    LOCAL_BACKUP="$PRESERVED_BACKUP"
    chmod 600 "$PRESERVED_BACKUP"
    LOCAL_BACKUP=""
    echo "[backup-validation] PASS. Encryption-at-rest handling remains the operator's responsibility."
    echo "[backup-validation] Preserved local backup at $PRESERVED_BACKUP"
else
    echo "[backup-validation] PASS. The temporary local backup will now be deleted."
fi
