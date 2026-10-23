"""One capability boundary for interactive CMS accounts; machine scopes stay independent."""

from rest_framework.permissions import SAFE_METHODS

from .machine_api_keys import ALLOWED_SCOPES, SERVER_FULL_ACCESS, _required_scope
from .models import TenantRole

EXTRA_PERMISSIONS = {
    "roles.manage",
    "support.read",
    "support.publish",
    "tenant.admin",
    "settings.read",
    "settings.write",
    "integrations.manage",
    "statistics.read",
    "ai.use",
}
ROLE_PERMISSIONS = sorted((set(ALLOWED_SCOPES) - {SERVER_FULL_ACCESS}) | EXTRA_PERMISSIONS)
DEFAULT_PERMISSIONS = {p for p in ROLE_PERMISSIONS if p.endswith(".read") and not p.startswith("support.")} | {
    "kanban.write"
}


def permissions_for(user, tenant):
    if not user or not user.is_authenticated or not user.is_active or not tenant or not tenant.is_active:
        return set()
    if not tenant.user_has_access(user):
        assignments = getattr(tenant, "theme_designer_assignments", None)
        if assignments is not None and assignments.filter(user=user).exists():
            return {"theme.read", "theme.write", "theme.version", "layout.read", "site.read"}
        return set()
    if user.is_superuser or tenant.created_by_id == user.pk:
        return (
            (set(ROLE_PERMISSIONS) - {"support.read", "support.publish"})
            | {"tenant.admin"}
            | {p for role in TenantRole.objects.filter(tenant=tenant, users=user) for p in role.permissions}
        )
    roles = TenantRole.objects.filter(tenant=tenant, users=user)
    if not roles.exists():
        return DEFAULT_PERMISSIONS.copy()
    return {permission for role in roles for permission in role.permissions}


def can_manage_roles(user, tenant):
    return "roles.manage" in permissions_for(user, tenant)


def allows_request(request):
    path = request.path
    tenant = getattr(request, "tenant", None)
    user = getattr(request, "user", None)
    if not path.startswith("/api/v1/") or not user or not user.is_authenticated:
        return True  # Existing authentication and public endpoint policies apply.
    from .models import MachineAPIKey

    if isinstance(getattr(request, "auth", None), MachineAPIKey):
        return True
    if user.is_superuser:
        return True
    if path.startswith(
        (
            "/api/v1/auth/",
            "/api/v1/utils/current-user/",
            "/api/v1/utils/current-workspace/",
            "/api/v1/utils/change-password/",
            "/api/v1/utils/profile-photos/",
        )
    ):
        return True
    permissions = permissions_for(user, tenant)
    if "tenant.admin" in permissions:
        return True
    if path.startswith("/api/v1/utils/roles/"):
        return bool(permissions) if request.method in SAFE_METHODS else "roles.manage" in permissions
    if path.startswith("/api/v1/support/"):
        return bool(tenant and user.is_active and tenant.is_active and tenant.user_has_access(user))
        # Support views enforce participant access and combine direct and CMS support grants.
    if path.startswith("/api/v1/utils/users/"):
        return False  # Global account administration remains a system-owner operation.
    # Human-facing helper routes are broader than the machine API contract.
    for prefixes, read, write in [
        (("/api/v1/namespaces/",), "site.read", "settings.write"),
        (("/api/v1/tags/",), "content.read", "content.write"),
        (("/api/v1/webpages/layout-editor/",), "theme.read", "theme.write"),
        (
            (
                "/api/v1/data-connections/",
                "/api/v1/webpages/designer/remote-connections/",
                "/api/v1/webpages/remote-sites/",
            ),
            "integrations.manage",
            "integrations.manage",
        ),
        (("/api/v1/statistics/", "/api/v1/analytics/"), "statistics.read", "statistics.read"),
        (("/api/v1/ai/", "/api/v1/ai-tracking/", "/api/v1/utils/ai-"), "ai.use", "ai.use"),
        (("/api/v1/utils/field-types/", "/api/v1/utils/value-lists-for-field/"), "site.read", "settings.write"),
    ]:
        if path.startswith(prefixes):
            return (read if request.method in SAFE_METHODS else write) in permissions
    if path.startswith("/api/v1/utils/clipboard/"):
        return bool(permissions)  # The existing view scopes clipboard entries to their owner.
    if path.startswith("/api/v1/media/") and tenant and not tenant.user_has_access(user):
        # Media also serves public resources and conceals private namespaces with 404.
        # Its existing namespace/object checks govern users outside this workspace.
        return True
    needed = _required_scope(request)
    return needed in permissions
