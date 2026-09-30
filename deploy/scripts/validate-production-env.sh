#!/usr/bin/env bash
# Validate production environment settings without printing secret values.

set -euo pipefail

ENV_FILE="${1:-}"
MATCH_PUBLISHER_ENV=""

if [ "${2:-}" = "--publisher-passwords-match" ]; then
    MATCH_PUBLISHER_ENV="${3:-}"
elif [ -n "${2:-}" ]; then
    echo "[env-validation] Unsupported validation option." >&2
    exit 2
fi

error() {
    echo "[env-validation] $*" >&2
}

if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
    error "A production environment file is required."
    exit 1
fi

if grep -qE 'your-long-random-secret-key|your-secure-postgres-password' "$ENV_FILE"; then
    error "Production environment placeholders must be replaced."
    exit 1
fi

read_env_value() {
    local variable_name="$1"
    local source_file="${2:-$ENV_FILE}"
    local value
    value=$(grep -E "^${variable_name}=" "$source_file" | tail -1 | cut -d= -f2- | tr -d '\r' || true)
    value="${value#\"}"; value="${value%\"}"
    value="${value#\'}"; value="${value%\'}"
    printf '%s' "$value"
}

if ! grep -qE '^DOMAIN=[^[:space:]]' "$ENV_FILE"; then
    error "DOMAIN must be set to a non-empty production hostname."
    exit 1
fi

postgres_host=$(read_env_value POSTGRES_HOST)
if [ "$postgres_host" != "db" ]; then
    error "POSTGRES_HOST must use the production Compose service name db."
    exit 1
fi
unset postgres_host

if grep -qE '^REDIS_URL=.*eceee-v4-redis' "$ENV_FILE"; then
    error "REDIS_URL must use the production Compose service name redis."
    exit 1
fi

secret_key=$(read_env_value SECRET_KEY)
if [ "$secret_key" = "dev-secret-key-change-in-production" ] || [ "${#secret_key}" -lt 50 ]; then
    error "SECRET_KEY must contain a generated value of at least 50 characters."
    exit 1
fi
unset secret_key

publisher_password_is_valid() {
    local value="$1"
    [[ "$value" =~ ^[A-Za-z0-9._~-]{24,128}$ ]] && [[ "$value" != replace-with-* ]]
}

publisher_db_password=$(read_env_value PUBLISHER_DB_PASSWORD)
publisher_form_db_password=$(read_env_value PUBLISHER_FORM_DB_PASSWORD)
if ! publisher_password_is_valid "$publisher_db_password"; then
    error "PUBLISHER_DB_PASSWORD must contain a generated 24-128 character URL-safe value."
    exit 1
fi
if ! publisher_password_is_valid "$publisher_form_db_password"; then
    error "PUBLISHER_FORM_DB_PASSWORD must contain a generated 24-128 character URL-safe value."
    exit 1
fi
if [ "$publisher_db_password" = "$publisher_form_db_password" ]; then
    error "Publisher read and form passwords must be independent."
    exit 1
fi

if [ -n "$MATCH_PUBLISHER_ENV" ]; then
    if [ ! -f "$MATCH_PUBLISHER_ENV" ]; then
        error "The current production environment is required for restart validation."
        exit 1
    fi
    current_publisher_db_password=$(read_env_value PUBLISHER_DB_PASSWORD "$MATCH_PUBLISHER_ENV")
    current_publisher_form_db_password=$(read_env_value PUBLISHER_FORM_DB_PASSWORD "$MATCH_PUBLISHER_ENV")
    if [ "$publisher_db_password" != "$current_publisher_db_password" ] || \
       [ "$publisher_form_db_password" != "$current_publisher_form_db_password" ]; then
        error "Publisher password rotation requires a deploy, not a restart-only operation."
        exit 1
    fi
    unset current_publisher_db_password current_publisher_form_db_password
fi
unset publisher_db_password publisher_form_db_password

echo "[env-validation] Production environment validation passed."
