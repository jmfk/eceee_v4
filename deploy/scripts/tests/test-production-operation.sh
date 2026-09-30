#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPTS="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
TEST_DIR=$(cd "$TEST_DIR" && pwd -P)

mkdir -p "$TEST_DIR/repo/deploy/scripts" "$TEST_DIR/bin"
cp "$DEPLOY_SCRIPTS/production-operation.sh" "$TEST_DIR/repo/deploy/scripts/"
cp "$DEPLOY_SCRIPTS/validate-production-env.sh" "$TEST_DIR/repo/deploy/scripts/"
cat > "$TEST_DIR/bin/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TEST_DIR/bin/flock"

write_valid_env() {
    local path="$1"
    local read_password="$2"
    local form_password="$3"
    {
        printf 'DOMAIN=example.com\n'
        printf 'POSTGRES_HOST=db\n'
        printf 'REDIS_URL=redis://redis:6379/0\n'
        printf 'SECRET_KEY=%064d\n' 0
        printf 'PUBLISHER_DB_PASSWORD=%s\n' "$read_password"
        printf 'PUBLISHER_FORM_DB_PASSWORD=%s\n' "$form_password"
    } > "$path"
    chmod 600 "$path"
}

write_valid_env "$TEST_DIR/repo/deploy/.env" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
cp "$TEST_DIR/repo/deploy/.env" "$TEST_DIR/original.env"

invalid_stage="$TEST_DIR/repo/deploy/.env.incoming.invalid"
write_valid_env "$invalid_stage" "same-password-value-1234567890" "same-password-value-1234567890"
if (
    cd "$TEST_DIR/repo"
    PATH="$TEST_DIR/bin:$PATH" ECEEE_PRODUCTION_LOCK_FILE="$TEST_DIR/operation.lock" \
        bash deploy/scripts/production-operation.sh install-env "$invalid_stage"
) >/dev/null 2>&1; then
    echo "production operation unexpectedly installed an invalid environment" >&2
    exit 1
fi
if ! cmp -s "$TEST_DIR/original.env" "$TEST_DIR/repo/deploy/.env"; then
    echo "invalid staged environment replaced the current environment" >&2
    exit 1
fi

install_password_change="$TEST_DIR/repo/deploy/.env.incoming.install-password-change"
write_valid_env "$install_password_change" "cccccccccccccccccccccccccccccccc" "dddddddddddddddddddddddddddddddd"
if (
    cd "$TEST_DIR/repo"
    PATH="$TEST_DIR/bin:$PATH" ECEEE_PRODUCTION_LOCK_FILE="$TEST_DIR/operation.lock" \
        bash deploy/scripts/production-operation.sh install-env "$install_password_change"
) >/dev/null 2>&1; then
    echo "production operation unexpectedly accepted publisher password rotation during install-env" >&2
    exit 1
fi
if ! cmp -s "$TEST_DIR/original.env" "$TEST_DIR/repo/deploy/.env"; then
    echo "rejected install-env password rotation changed the current environment" >&2
    exit 1
fi

cat > "$TEST_DIR/repo/deploy/scripts/env.sh" <<'EOF'
docker_compose() {
    return 0
}
EOF
cat > "$TEST_DIR/repo/deploy/scripts/healthcheck.sh" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF

password_change_stage="$TEST_DIR/repo/deploy/.env.incoming.password-change"
write_valid_env "$password_change_stage" "cccccccccccccccccccccccccccccccc" "dddddddddddddddddddddddddddddddd"
if (
    cd "$TEST_DIR/repo"
    PATH="$TEST_DIR/bin:$PATH" ECEEE_PRODUCTION_LOCK_FILE="$TEST_DIR/operation.lock" \
        bash deploy/scripts/production-operation.sh restart "$password_change_stage"
) >/dev/null 2>&1; then
    echo "production operation unexpectedly accepted publisher password rotation during restart" >&2
    exit 1
fi
if ! cmp -s "$TEST_DIR/original.env" "$TEST_DIR/repo/deploy/.env"; then
    echo "rejected restart password rotation changed the current environment" >&2
    exit 1
fi

restart_stage="$TEST_DIR/repo/deploy/.env.incoming.restart"
write_valid_env "$restart_stage" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
printf 'EMAIL=restart@example.com\n' >> "$restart_stage"
cp "$restart_stage" "$TEST_DIR/restart.env"
restart_log="$TEST_DIR/restart.log"
if (
    cd "$TEST_DIR/repo"
    PATH="$TEST_DIR/bin:$PATH" ECEEE_PRODUCTION_LOCK_FILE="$TEST_DIR/operation.lock" \
        bash deploy/scripts/production-operation.sh restart "$restart_stage"
) >"$restart_log" 2>&1; then
    echo "production operation unexpectedly accepted a failed restart" >&2
    exit 1
fi
if ! cmp -s "$TEST_DIR/restart.env" "$TEST_DIR/repo/deploy/.env"; then
    if cmp -s "$TEST_DIR/original.env" "$TEST_DIR/repo/deploy/.env"; then
        echo "failed restart retained the previous environment instead of committing the validated one" >&2
    else
        echo "failed restart left an unexpected environment file" >&2
    fi
    while IFS= read -r line; do
        echo "restart diagnostic: $line" >&2
    done < "$restart_log"
    exit 1
fi

echo "production operation environment commit tests passed"
