from rest_framework import permissions


class HasTenantAccess(permissions.BasePermission):
    """Require authenticated administrative access to the selected tenant."""

    message = "You do not have access to this tenant."

    def has_permission(self, request, view):
        tenant = getattr(request, "tenant", None)
        return bool(tenant and tenant.user_has_access(request.user))
