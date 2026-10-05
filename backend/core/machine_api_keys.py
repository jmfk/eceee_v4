"""Machine API-key generation, authentication, and capability checks."""

import hashlib
import secrets

from django.conf import settings
from django.utils import timezone
from rest_framework import authentication, exceptions

from core.models import MachineAPIKey

SERVER_FULL_ACCESS = "server.full_access"
THEME_READ = "theme.read"
THEME_WRITE = "theme.write"
THEME_VERSION = "theme.version"
THEME_TRANSFER = "theme.transfer"
ALLOWED_SCOPES = {SERVER_FULL_ACCESS, THEME_READ, THEME_WRITE, THEME_VERSION, THEME_TRANSFER}
AUTH_SCHEME = b"ApiKey"
MACHINE_DENIED_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/core/machine-api-keys",
    "/api/v1/utils/change-password/",
    "/api/v1/utils/current-workspace/",
    "/api/v1/utils/users/",
    "/api/v1/webpages/designer/remote-connections/",
)


def deployment_environment():
    return getattr(settings, "DEPLOYMENT_ENVIRONMENT", "development")


def generate_machine_api_key():
    raw_key = f"mapi_{secrets.token_urlsafe(32)}"
    return raw_key, hashlib.sha256(raw_key.encode()).hexdigest(), raw_key[:16]


def _required_scope(request):
    if request.path.startswith(MACHINE_DENIED_PREFIXES):
        return None
    if request.path.startswith("/api/v1/webpages/themes/sync/") or request.path.startswith(
        "/api/v1/webpages/designer/themes/remote/"
    ):
        return THEME_TRANSFER
    if request.path.startswith("/api/v1/webpages/designer/theme-exports/"):
        return THEME_READ
    if request.path.startswith("/api/v1/webpages/designer/themes/") and "/versions/" in request.path:
        return THEME_VERSION
    theme_prefixes = ("/api/v1/webpages/themes/", "/api/v1/webpages/designer/themes/")
    if request.path.startswith(theme_prefixes):
        return THEME_READ if request.method in {"GET", "HEAD", "OPTIONS"} else THEME_WRITE
    return SERVER_FULL_ACCESS


class MachineAPIKeyAuthentication(authentication.BaseAuthentication):
    keyword = AUTH_SCHEME

    def authenticate(self, request):
        parts = authentication.get_authorization_header(request).split()
        if not parts or parts[0] != self.keyword:
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Invalid machine API key.")
        digest = hashlib.sha256(parts[1]).hexdigest()
        try:
            api_key = MachineAPIKey.objects.select_related("principal").get(
                key_hash=digest,
                is_active=True,
                environment=deployment_environment(),
            )
        except MachineAPIKey.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Invalid machine API key.") from exc
        if not api_key.principal.is_active or (api_key.expires_at and api_key.expires_at <= timezone.now()):
            raise exceptions.AuthenticationFailed("Invalid machine API key.")
        required_scope = _required_scope(request)
        scopes = set(api_key.scopes)
        if required_scope is None or (SERVER_FULL_ACCESS not in scopes and required_scope not in scopes):
            raise exceptions.PermissionDenied("This machine API key is not permitted for this endpoint.")
        MachineAPIKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        return api_key.principal, api_key

    def authenticate_header(self, request):
        return self.keyword.decode()
