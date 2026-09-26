from rest_framework import permissions


def user_can_switch_tenant(user):
    """Workspace switching is reserved for the local dev account and superusers."""
    return bool(user and user.is_authenticated and (user.is_superuser or user.username == "dev_auto_user"))


class HasTenantAccess(permissions.BasePermission):
    """Require authenticated administrative access to the selected tenant."""

    message = "You do not have access to this tenant."

    def has_permission(self, request, view):
        tenant = getattr(request, "tenant", None)
        return bool(tenant and tenant.user_has_access(request.user))
