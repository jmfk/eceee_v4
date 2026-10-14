"""Write-only encrypted credentials for tenant data connections."""

import json

from webpages.services.theme_remote_credentials import (
    RemoteCredentialConfigurationError,
    decrypt_access_key,
    encrypt_access_key,
)

SENSITIVE_CONFIG_KEYS = {"password", "token", "apiKeyValue", "api_key_value"}
SENSITIVE_HEADER_NAMES = {"authorization", "proxy-authorization", "x-api-key"}


def split_sensitive_config(config):
    """Return public config and secrets without mutating the submitted mapping."""

    public = dict(config or {})
    secrets = {}
    for key in list(public):
        if key in SENSITIVE_CONFIG_KEYS:
            value = public.pop(key)
            if value not in (None, ""):
                secrets[key] = value
    headers = dict(public.get("headers") or {})
    secret_headers = {}
    for key in list(headers):
        if key.lower() in SENSITIVE_HEADER_NAMES:
            value = headers.pop(key)
            if value not in (None, ""):
                secret_headers[key] = value
    if "headers" in public:
        public["headers"] = headers
    if secret_headers:
        secrets["headers"] = secret_headers
    return public, secrets


def encrypt_connection_secrets(secrets):
    if not secrets:
        return ""
    return encrypt_access_key(json.dumps(secrets, separators=(",", ":"), sort_keys=True))


def decrypt_connection_secrets(connection):
    if not connection.encrypted_secrets:
        return {}
    try:
        value = json.loads(decrypt_access_key(connection.encrypted_secrets))
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RemoteCredentialConfigurationError("The saved connection credential is invalid.") from exc
    if not isinstance(value, dict):
        raise RemoteCredentialConfigurationError("The saved connection credential is invalid.")
    return value


def resolved_connection_config(connection):
    """Merge decrypted secrets for trusted server-side connector code only."""

    config = dict(connection.config or {})
    secrets = decrypt_connection_secrets(connection)
    secret_headers = secrets.pop("headers", None)
    config.update(secrets)
    if secret_headers:
        config["headers"] = {**(config.get("headers") or {}), **secret_headers}
    return config
