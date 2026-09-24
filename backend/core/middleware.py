"""
Tenant Context Middleware

Extracts tenant from request and sets PostgreSQL session variable for RLS policies.
Also adds tenant object to request for use in views.
"""

from django.conf import settings
from django.db.models import Q
from django.http import HttpResponseForbidden

from core.models import Tenant
from core.rls import clear_tenant_context, set_tenant_context


class TenantContextMiddleware:
    """
    Middleware to set tenant context for RLS policies.

    Tenant detection priority:
    1. X-Tenant-ID header (for API requests, theme-sync, etc.)
    2. User's tenant association (if users are linked to tenants in future)
    3. Fallback: DEFAULT_TENANT_ID (dev) or 403 error (prod)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    EXEMPT_PATHS = ("/health/",)

    class InvalidTenantSelection(ValueError):
        pass

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.EXEMPT_PATHS):
            request.tenant = None
            return self.get_response(request)

        try:
            tenant = self.get_tenant(request)
        except self.InvalidTenantSelection:
            clear_tenant_context()
            return HttpResponseForbidden("The selected tenant does not exist or is inactive.")

        if tenant is None:
            default_tenant_id = getattr(settings, "DEFAULT_TENANT_ID", None)
            if default_tenant_id:
                try:
                    tenant = Tenant.objects.get(id=default_tenant_id)
                except Tenant.DoesNotExist:
                    tenant = Tenant.objects.filter(is_active=True).first()
            else:
                tenant = Tenant.objects.filter(is_active=True).first()

            if tenant is None and getattr(settings, "REQUIRE_TENANT", not settings.DEBUG):
                return HttpResponseForbidden("No active tenant found. Create a tenant or configure DEFAULT_TENANT_ID.")

        # Set tenant context for RLS
        if tenant:
            set_tenant_context(tenant.id)
            request.tenant = tenant
        else:
            # No tenant available - clear context
            clear_tenant_context()
            request.tenant = None

        response = self.get_response(request)

        # Clear tenant context after request
        clear_tenant_context()

        return response

    def get_tenant(self, request):
        """
        Extract tenant from request.

        Priority:
        1. X-Tenant-ID header
        2. User's tenant association (future)
        3. None (fallback to default or error)
        """
        # 1. Check X-Tenant-ID header
        tenant_id_header = request.headers.get("X-Tenant-ID")
        if tenant_id_header:
            try:
                # Try by UUID ID first
                import uuid

                tenant_uuid = uuid.UUID(tenant_id_header)
                tenant = Tenant.objects.get(id=tenant_uuid, is_active=True)
                return tenant
            except (ValueError, Tenant.DoesNotExist):
                # Try by identifier
                try:
                    tenant = Tenant.objects.get(identifier=tenant_id_header, is_active=True)
                    return tenant
                except Tenant.DoesNotExist:
                    raise self.InvalidTenantSelection from None

        # 2. An omitted header is only unambiguous when the user can access one tenant.
        if request.user.is_authenticated:
            accessible = (
                Tenant.objects.filter(is_active=True)
                .filter(
                    Q(created_by=request.user)
                    | Q(members=request.user)
                    | Q(theme_designer_assignments__user=request.user)
                )
                .distinct()
            )
            if accessible.count() == 1:
                return accessible.first()

        # 3. No tenant found
        return None
