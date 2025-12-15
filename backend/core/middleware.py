"""
Tenant Context Middleware

Extracts tenant from request and sets PostgreSQL session variable for RLS policies.
Also adds tenant object to request for use in views.
"""

from django.conf import settings
from django.http import HttpResponseForbidden
from core.models import Tenant
from core.rls import set_tenant_context, clear_tenant_context


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
    
    def __call__(self, request):
        tenant = self.get_tenant(request)
        
        if tenant is None:
            # No tenant found - check if we should allow or deny
            default_tenant_id = getattr(settings, 'DEFAULT_TENANT_ID', None)
            require_tenant = getattr(settings, 'REQUIRE_TENANT', not settings.DEBUG)
            
            if require_tenant:
                return HttpResponseForbidden(
                    "Tenant is required. Provide X-Tenant-ID header or configure DEFAULT_TENANT_ID."
                )
            elif default_tenant_id:
                try:
                    tenant = Tenant.objects.get(id=default_tenant_id)
                except Tenant.DoesNotExist:
                    # Default tenant doesn't exist - try to get first active tenant
                    tenant = Tenant.objects.filter(is_active=True).first()
            else:
                # No default tenant configured - try to get first active tenant
                tenant = Tenant.objects.filter(is_active=True).first()
        
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
        tenant_id_header = request.headers.get('X-Tenant-ID')
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
                    pass
        
        # 2. Check user's tenant association (future - when user-tenant model exists)
        # if request.user.is_authenticated:
        #     user_tenant = getattr(request.user, 'tenant', None)
        #     if user_tenant:
        #         return user_tenant
        
        # 3. No tenant found
        return None

