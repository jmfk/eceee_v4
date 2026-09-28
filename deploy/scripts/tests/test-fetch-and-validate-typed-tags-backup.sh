#!/usr/bin/env bash

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBJECT="$SCRIPT_DIR/../fetch-and-validate-typed-tags-backup.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/eceee-backup-orchestration-test.XXXXXX")"

cleanup() {
    rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

FAKE_BIN="$TEST_ROOT/bin"
FIXTURE="$TEST_ROOT/production-backup.sql.gz"
VALIDATED_PATH_FILE="$TEST_ROOT/validated-path"
mkdir -p "$FAKE_BIN"
printf 'safe test fixture\n' | gzip > "$FIXTURE"

cat > "$FAKE_BIN/ssh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
    *--print-basename)
        printf '%s\n' "${FAKE_REMOTE_BASENAME:-eceee_v4_20260928_120000_123.sql.gz}"
        ;;
    *sha256sum*)
        if [ "${FAKE_BAD_CHECKSUM:-0}" = "1" ]; then
            printf '%064d\n' 0
            exit 0
        fi
        python3 - "$FIXTURE_FILE" <<'PY'
import hashlib
import sys

print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())
PY
        ;;
    *)
        exit 99
        ;;
esac
SH

cat > "$FAKE_BIN/scp" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
destination="${2:?destination is required}"
cp "$FIXTURE_FILE" "$destination"
SH

cat > "$FAKE_BIN/validator" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[ "${DOCKER_CONTEXT:-}" = "orbstack" ]
python3 - "$1" <<'PY'
import os
import sys

assert os.stat(sys.argv[1]).st_mode & 0o777 == 0o600
PY
printf '%s\n' "$1" > "$VALIDATED_PATH_FILE"
SH

chmod +x "$FAKE_BIN/ssh" "$FAKE_BIN/scp" "$FAKE_BIN/validator"
export PATH="$FAKE_BIN:$PATH"
export FIXTURE_FILE="$FIXTURE"
export VALIDATED_PATH_FILE
export TYPED_TAG_BACKUP_VALIDATOR="$FAKE_BIN/validator"

"$SUBJECT" root@example.test /srv/eceee_v4 >/dev/null
VALIDATED_PATH="$(cat "$VALIDATED_PATH_FILE")"
[ ! -e "$VALIDATED_PATH" ] || { echo "Temporary backup was not deleted." >&2; exit 1; }

PRESERVE_DIR="$TEST_ROOT/preserved"
KEEP_BACKUP=1 LOCAL_BACKUP_DIR="$PRESERVE_DIR" "$SUBJECT" root@example.test /srv/eceee_v4 >/dev/null
PRESERVED_BACKUP="$PRESERVE_DIR/eceee_v4_20260928_120000_123.sql.gz"
[ -f "$PRESERVED_BACKUP" ] || { echo "Requested backup was not preserved." >&2; exit 1; }
cmp "$FIXTURE" "$PRESERVED_BACKUP"

rm -f "$VALIDATED_PATH_FILE"
if FAKE_BAD_CHECKSUM=1 "$SUBJECT" root@example.test /srv/eceee_v4 >/dev/null 2>&1; then
    echo "Checksum mismatch unexpectedly passed." >&2
    exit 1
fi
[ ! -e "$VALIDATED_PATH_FILE" ] || { echo "Validator ran after a checksum mismatch." >&2; exit 1; }

if FAKE_REMOTE_BASENAME=unexpected.sql.gz "$SUBJECT" root@example.test /srv/eceee_v4 >/dev/null 2>&1; then
    echo "Invalid remote basename unexpectedly passed." >&2
    exit 1
fi

echo "fetch-and-validate typed-tag backup orchestration: PASS"
