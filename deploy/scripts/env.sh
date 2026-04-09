# shellcheck shell=bash
# Shared paths for production scripts under deploy/scripts/.
# Source after setting SCRIPT_DIR to this directory:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   # shellcheck source=deploy/scripts/env.sh
#   source "$SCRIPT_DIR/env.sh"
#   cd "$DEPLOY_DIR" || exit 1

: "${SCRIPT_DIR:?env.sh requires SCRIPT_DIR}"

DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

# Compose substitutes ${DOMAIN} / ${EMAIL} in docker-compose.prod.yml at parse time.
# Export from deploy/.env so build/up always see them (avoids "DOMAIN is not set" warnings).
_eceee_env_strip() {
    local v="$1"
    v="${v%$'\r'}"
    if [[ "$v" =~ ^\".*\"$ ]]; then v="${v#\"}"; v="${v%\"}"; fi
    if [[ "$v" =~ ^\'.*\'$ ]]; then v="${v#\'}"; v="${v%\'}"; fi
    printf '%s' "$v"
}

if [[ -f "$ENV_FILE" ]]; then
    _line=$(grep -E '^DOMAIN=' "$ENV_FILE" | tail -1 || true)
    if [[ -n "$_line" ]]; then
        export DOMAIN="$(_eceee_env_strip "${_line#DOMAIN=}")"
    fi
    _line=$(grep -E '^EMAIL=' "$ENV_FILE" | tail -1 || true)
    if [[ -n "$_line" ]]; then
        export EMAIL="$(_eceee_env_strip "${_line#EMAIL=}")"
    fi
    unset _line
fi
unset -f _eceee_env_strip

# Always use absolute paths so compose interpolation and volume paths work regardless of cwd.
docker_compose() {
    docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" "$@"
}
