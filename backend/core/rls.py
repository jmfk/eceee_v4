"""
Row Level Security (RLS) helper functions for tenant isolation.

These functions manage PostgreSQL session variables to set tenant context
for RLS policies.
"""

from django.db import connection


def set_tenant_context(tenant_id):
    """
    Set the current tenant context in PostgreSQL session variable.
    
    This is used by RLS policies to filter rows by tenant_id.
    
    Args:
        tenant_id: UUID tenant ID to set as current tenant
    """
    with connection.cursor() as cursor:
        cursor.execute("SET app.current_tenant_id = %s", [str(tenant_id)])


def get_current_tenant_id():
    """
    Get the current tenant ID from PostgreSQL session variable.
    
    Returns:
        UUID string or None: Current tenant ID, or None if not set
    """
    with connection.cursor() as cursor:
        try:
            cursor.execute("SELECT current_setting('app.current_tenant_id', true)::uuid")
            result = cursor.fetchone()
            if result:
                return result[0]
        except Exception:
            # Setting not found or not set
            return None
    return None


def clear_tenant_context():
    """
    Clear the tenant context by resetting the session variable.
    """
    with connection.cursor() as cursor:
        cursor.execute("RESET app.current_tenant_id")

