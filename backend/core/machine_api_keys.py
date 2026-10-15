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
PAGE_READ = "page.read"
PAGE_WRITE = "page.write"
PAGE_PUBLISH = "page.publish"
MEDIA_READ = "media.read"
MEDIA_WRITE = "media.write"
OBJECT_WRITE = "object.write"
OBJECT_PUBLISH = "object.publish"
LAYOUT_READ = "layout.read"
SITE_READ = "site.read"
CONTENT_READ = "content.read"
CONTENT_WRITE = "content.write"
SITE_TRANSFER = "site.transfer"
OBJECT_READ = "object.read"
OBJECT_TRANSFER = "object.transfer"
ALLOWED_SCOPES = {
    SERVER_FULL_ACCESS,
    THEME_READ,
    THEME_WRITE,
    THEME_VERSION,
    THEME_TRANSFER,
    PAGE_READ,
    PAGE_WRITE,
    PAGE_PUBLISH,
    MEDIA_READ,
    MEDIA_WRITE,
    OBJECT_WRITE,
    OBJECT_PUBLISH,
    LAYOUT_READ,
    SITE_READ,
    CONTENT_READ,
    CONTENT_WRITE,
    SITE_TRANSFER,
    OBJECT_READ,
    OBJECT_TRANSFER,
}
AUTH_SCHEME = b"ApiKey"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
MACHINE_DENIED_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/core/machine-api-keys",
    "/api/v1/data-connections/",
    "/api/v1/utils/change-password/",
    "/api/v1/utils/current-workspace/",
    "/api/v1/utils/users/",
    "/api/v1/webpages/designer/remote-connections/",
    "/api/v1/webpages/remote-sites/access-keys/",
)

PAGE_PUBLISH_ACTIONS = {
    "bulk-publish",
    "bulk-publish-explicit",
    "bulk-schedule",
    "bulk-schedule-explicit",
    "bulk-unpublish",
    "cancel-schedule",
    "publish",
    "publish-latest",
    "publishing",
    "schedule",
    "unpublish",
    "unpublish-all",
    "unpublish-explicit",
}
OBJECT_PUBLISH_ACTIONS = {"publish", "schedule", "unpublish"}
OBJECT_FULL_ACCESS_PATHS = {"/api/v1/objects/objects/bulk-operations"}


def deployment_environment():
    return getattr(settings, "DEPLOYMENT_ENVIRONMENT", "development")


def generate_machine_api_key():
    raw_key = f"mapi_{secrets.token_urlsafe(32)}"
    return raw_key, hashlib.sha256(raw_key.encode()).hexdigest(), raw_key[:16]


def _path_has_action(path, actions):
    return bool(set(path.strip("/").split("/")) & actions)


def _read_or_write_scope(request, read_scope, write_scope):
    return read_scope if request.method in SAFE_METHODS else write_scope


def _required_scope(request):
    if request.path.startswith(MACHINE_DENIED_PREFIXES):
        return None
    if request.path.startswith("/api/v1/webpages/themes/sync/") or request.path.startswith(
        "/api/v1/webpages/designer/themes/remote/"
    ):
        return THEME_TRANSFER
    if request.path.startswith("/api/v1/webpages/site-packages/remote-source/"):
        return SITE_TRANSFER
    if request.path.startswith("/api/v1/webpages/site-packages/"):
        return SITE_TRANSFER
    if request.path.startswith("/api/v1/objects/remote-source/exports/"):
        return OBJECT_TRANSFER
    if request.path.startswith("/api/v1/objects/remote-source/"):
        return OBJECT_READ
    if request.path.startswith("/api/v1/objects/remote/"):
        return OBJECT_TRANSFER
    if request.path.startswith("/api/v1/webpages/designer/theme-exports/"):
        return THEME_READ
    if request.path == "/api/v1/webpages/designer/themes/compare/" or (
        request.path.startswith("/api/v1/webpages/designer/themes/") and request.path.endswith("/export/")
    ):
        return THEME_READ
    if request.path.startswith("/api/v1/webpages/designer/themes/") and "/versions/" in request.path:
        return THEME_VERSION
    theme_prefixes = ("/api/v1/webpages/themes/", "/api/v1/webpages/designer/themes/")
    if request.path.startswith(theme_prefixes):
        return _read_or_write_scope(request, THEME_READ, THEME_WRITE)

    if request.path.startswith("/api/v1/webpages/layouts/"):
        if request.path == "/api/v1/webpages/layouts/reload/":
            return SERVER_FULL_ACCESS
        return LAYOUT_READ
    if request.path.startswith("/api/v1/webpages/widget-types/"):
        return LAYOUT_READ

    if request.path.startswith("/api/v1/webpages/path-patterns/"):
        return SITE_READ
    if request.path.rstrip("/") == "/api/v1/webpages/page-data-schemas/validate":
        return SITE_READ
    global_site_configuration_prefixes = (
        "/api/v1/webpages/page-data-schemas/",
        "/api/v1/webpages/preview-sizes/",
        "/api/v1/utils/value-lists/",
    )
    if request.path.startswith(global_site_configuration_prefixes):
        return SITE_READ if request.method in SAFE_METHODS else SERVER_FULL_ACCESS

    page_prefixes = (
        "/api/v1/webpages/pages/",
        "/api/v1/webpages/versions/",
        "/api/v1/webpages/page-versions/",
    )
    if request.path.startswith(page_prefixes):
        if request.method not in SAFE_METHODS and _path_has_action(request.path, PAGE_PUBLISH_ACTIONS):
            return PAGE_PUBLISH
        return _read_or_write_scope(request, PAGE_READ, PAGE_WRITE)

    if request.path.startswith("/api/v1/media/"):
        return _read_or_write_scope(request, MEDIA_READ, MEDIA_WRITE)

    if request.path.startswith("/api/v1/objects/"):
        if request.path.startswith("/api/v1/objects/object-types/"):
            return OBJECT_READ if request.method in SAFE_METHODS else SERVER_FULL_ACCESS
        if request.path.rstrip("/") in OBJECT_FULL_ACCESS_PATHS:
            return SERVER_FULL_ACCESS
        if request.method not in SAFE_METHODS and _path_has_action(request.path, OBJECT_PUBLISH_ACTIONS):
            return OBJECT_PUBLISH
        return _read_or_write_scope(request, OBJECT_READ, OBJECT_WRITE)

    if request.path.startswith("/api/v1/content/"):
        return _read_or_write_scope(request, CONTENT_READ, CONTENT_WRITE)
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
