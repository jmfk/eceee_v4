#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cat > "$work/base" <<'EOF'
DOMAIN=example.invalid
POSTGRES_HOST=db
SECRET_KEY=synthetic-test-only-secret-key-with-more-than-fifty-characters
PUBLISHER_DB_PASSWORD=synthetic-read-password-12345678
PUBLISHER_FORM_DB_PASSWORD=synthetic-form-password-12345678
AWS_ACCESS_KEY_ID=synthetic-media-key
EOF
validate() { bash "$SCRIPT_DIR/../validate-production-env.sh" "$work/env" >/dev/null 2>&1; }
cp "$work/base" "$work/env"
validate
printf 'SUPPORT_STORAGE_BUCKET_NAME=synthetic-support\n' >> "$work/env"
if validate; then echo 'Missing support credentials accepted' >&2; exit 1; fi
printf 'SUPPORT_STORAGE_ACCESS_KEY_ID=synthetic-support-key\n' >> "$work/env"
if validate; then echo 'Incomplete support credentials accepted' >&2; exit 1; fi
printf 'SUPPORT_STORAGE_SECRET_ACCESS_KEY=synthetic-support-secret\n' >> "$work/env"
validate
printf 'SUPPORT_STORAGE_ACCESS_KEY_ID=synthetic-media-key\n' >> "$work/env"
if validate; then echo 'Reused imgproxy credentials accepted' >&2; exit 1; fi
cp "$work/base" "$work/env"
printf 'SUPPORT_STORAGE_ACCESS_KEY_ID=synthetic-support-key\nSUPPORT_STORAGE_SECRET_ACCESS_KEY=synthetic-support-secret\n' >> "$work/env"
if validate; then echo 'Support credentials without bucket accepted' >&2; exit 1; fi
echo 'Support storage environment checks passed (6 cases).'
