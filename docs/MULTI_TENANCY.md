# Multi-Tenancy Implementation

This document describes the multi-tenancy implementation in eceee_v4 using PostgreSQL Row Level Security (RLS) and Django middleware.

## Overview

Multi-tenancy in eceee_v4 provides **account/organization separation only**. Tenants do NOT define hostnames. Hostnames are managed separately via the `WebPage.hostnames` array field, allowing one tenant to have multiple hostnames/sites.

## Architecture

```
Tenant (Account/Organization)
├── id: UUID (primary key)
├── name: Human-readable name
├── identifier: URL-safe identifier (for theme-sync directory)
├── settings: JSON configuration
├── is_active: Boolean
├── created_by: Foreign key to User
│
├──> PageTheme (tenant-specific themes)
├──> WebPage (tenant-specific pages, each with multiple hostnames)
├──> Content models (Namespace, Category, Tag)
├──> ObjectStorage models (ObjectInstance)
└──> FileManager models (MediaFile)
```

### Key Points

- **Tenant = Account/Organization** (not hostname-based)
- **One tenant can have multiple hostnames** (via `WebPage.hostnames` array)
- **Theme-sync uses tenant identifier** (not hostname) for directory structure
- **RLS enforces data isolation** at the PostgreSQL level

## Database Schema

### Tenant Model

```python
class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=255)
    identifier = models.SlugField(unique=True, max_length=100)
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
```

### Models with Tenant Association

All content models include a `tenant` foreign key:

- `PageTheme` - Themes are tenant-specific
- `WebPage` - Pages belong to a tenant (with separate `hostnames` array)
- `Namespace`, `Category`, `Tag` - Content organization models
- `ObjectInstance` - Object storage instances
- `MediaFile` - Uploaded media files

## Row Level Security (RLS)

RLS is enabled on all tenant-associated tables to enforce data isolation at the database level.

### How RLS Works

1. Django middleware extracts tenant information from the request
2. Middleware sets PostgreSQL session variable: `app.current_tenant_id`
3. RLS policies filter all queries by this session variable
4. Users can only see/modify data for their current tenant

### RLS Policies

Each tenant-associated table has a policy like:

```sql
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Enabled Tables

- `core_tenant`
- `webpages_pagetheme`
- `webpages_webpage`
- `content_namespace`
- `content_category`
- `content_tag`
- `object_storage_objectinstance`
- `file_manager_mediafile`

## Tenant Detection

The `TenantContextMiddleware` detects the tenant from the request in this order:

1. **`X-Tenant-ID` header** - UUID or identifier (preferred for API/theme-sync)
2. **User-tenant association** - If users are linked to tenants (future)
3. **Fallback**:
   - Development (`DEBUG=True`): Use `DEFAULT_TENANT_ID` or first active tenant
   - Production (`REQUIRE_TENANT=True`): Return 403 error

### Configuration

In `backend/config/settings.py`:

```python
# Multi-tenancy configuration
TENANT_HEADER = "X-Tenant-ID"
DEFAULT_TENANT_ID = None  # UUID string or identifier (dev only)
REQUIRE_TENANT = not DEBUG  # Require tenant in production
```

### Middleware

```python
MIDDLEWARE = [
    # ... other middleware
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.TenantContextMiddleware",  # After auth, before DB queries
    # ... rest of middleware
]
```

## Theme-Sync Integration

Theme-sync uses the tenant identifier (not hostname) for directory structure and API calls.

### Configuration

In `docker-compose.dev.yml`:

```yaml
theme-sync:
  environment:
    - TENANT_ID=default  # Tenant identifier (required)
```

### Directory Structure

```
themes/
└── {TENANT_ID}/        # e.g., "default" or "eceee_org"
    ├── base/           # Base themes
    │   └── theme_name/
    │       └── theme.py
    └── custom/         # Custom themes
        └── theme_name/
            └── theme.py
```

### API Requests

Theme-sync includes `X-Tenant-ID` header in all API requests:

```python
self.session.headers.update({"X-Tenant-ID": self.tenant_id})
```

Backend API views filter themes by tenant from the request:

```python
themes = PageTheme.objects.filter(tenant=tenant)
```

## API Views

All API views filter querysets by tenant and set tenant on creation.

### Example: WebPageViewSet

```python
class WebPageViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = super().get_queryset()
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)
        return queryset

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise ValidationError("Tenant context is missing.")
        serializer.save(
            created_by=self.request.user,
            tenant=tenant,
        )
```

## Admin Interface

### Tenant Admin

```bash
# Access at: http://localhost:8000/admin/core/tenant/
```

Features:
- List view with name, identifier, is_active, created_at, created_by
- Filter by is_active, created_at
- Search by name, identifier
- Read-only: id, created_at, updated_at, created_by
- Auto-set created_by on creation

### PageTheme Admin

Features:
- Filter by tenant, is_active, is_default
- Auto-filter themes by request tenant
- Auto-set tenant from request on creation

## Management Commands

### Create Tenant

```bash
docker-compose exec backend python manage.py create_tenant \
    --name "ECEEE Organization" \
    --identifier eceee_org \
    --created-by admin
```

Options:
- `--name` - Human-readable name (required)
- `--identifier` - URL-safe identifier for theme-sync (required)
- `--created-by` - Username of creator (defaults to first superuser)
- `--inactive` - Create as inactive (default: active)

Output:
```
Successfully created tenant 'ECEEE Organization' (identifier: eceee_org, ID: <uuid>)
Theme-sync directory: themes/eceee_org/
Use TENANT_ID=eceee_org in docker-compose.dev.yml
```

## Hostname Management

Hostnames are managed separately from tenants via `WebPage.hostnames` array field.

### Key Points

- **Hostnames are NOT on Tenant model** - They're on WebPage
- **One tenant can have multiple hostnames** - Different sites under one account
- **One hostname can serve multiple pages** - Pages filter by hostname in view
- **Tenant detection does NOT use hostname** - Uses `X-Tenant-ID` header or fallback

### Example

Tenant: "ECEEE Organization" (identifier: `eceee_org`)

WebPages:
- Page 1: `hostnames=["eceee.org", "www.eceee.org"]` → Main site
- Page 2: `hostnames=["dev.eceee.org"]` → Dev site
- Page 3: `hostnames=["conference.eceee.org"]` → Conference site

All three pages belong to the same tenant but serve different hostnames.

## Usage Examples

### API Request with Tenant

```bash
curl -H "X-Tenant-ID: eceee_org" \
     -H "Authorization: Token <token>" \
     http://localhost:8000/api/v1/webpages/pages/
```

### Theme-Sync with Tenant

```yaml
# docker-compose.dev.yml
theme-sync:
  environment:
    - TENANT_ID=eceee_org
    - BACKEND_URL=http://backend:8000
    - API_TOKEN=<your-token>
```

### Django Shell

```python
from core.models import Tenant
from core.rls import set_tenant_context, clear_tenant_context

# Get tenant
tenant = Tenant.objects.get(identifier="eceee_org")

# Set tenant context
set_tenant_context(tenant.id)

# Query data (automatically filtered by RLS)
from webpages.models import PageTheme
themes = PageTheme.objects.all()  # Only returns themes for eceee_org

# Clear context
clear_tenant_context()
```

## Migration Strategy

The multi-tenancy implementation was added to an existing system with the following strategy:

1. Create `Tenant` model with UUID primary key
2. Add nullable `tenant` foreign key to all models
3. Create default tenant and assign all existing data to it
4. Make `tenant` foreign key non-nullable
5. Enable RLS and create policies

This ensures zero downtime and no data loss during migration.

## Security Considerations

### RLS Advantages

- **Database-level isolation** - Cannot be bypassed by application bugs
- **Defense in depth** - Even if middleware fails, RLS protects data
- **Connection pooling safe** - Session variable is connection-specific

### Best Practices

1. **Always use middleware** - Ensures tenant context is set
2. **Validate tenant in API views** - Raise error if tenant is missing
3. **Use UUID for tenant ID** - Prevents enumeration attacks
4. **Audit tenant access** - Log tenant switches and access patterns
5. **Test RLS policies** - Verify data isolation in tests

## Testing

### Test RLS Isolation

```python
from django.test import TestCase
from core.models import Tenant
from core.rls import set_tenant_context
from webpages.models import PageTheme

class TenantIsolationTestCase(TestCase):
    def test_rls_isolation(self):
        # Create two tenants
        tenant1 = Tenant.objects.create(name="Tenant 1", identifier="tenant1")
        tenant2 = Tenant.objects.create(name="Tenant 2", identifier="tenant2")
        
        # Create themes for each tenant
        set_tenant_context(tenant1.id)
        theme1 = PageTheme.objects.create(name="Theme 1", tenant=tenant1)
        
        set_tenant_context(tenant2.id)
        theme2 = PageTheme.objects.create(name="Theme 2", tenant=tenant2)
        
        # Verify isolation
        set_tenant_context(tenant1.id)
        self.assertEqual(PageTheme.objects.count(), 1)
        self.assertEqual(PageTheme.objects.first().name, "Theme 1")
        
        set_tenant_context(tenant2.id)
        self.assertEqual(PageTheme.objects.count(), 1)
        self.assertEqual(PageTheme.objects.first().name, "Theme 2")
```

## Troubleshooting

### Issue: 403 Forbidden - Tenant Required

**Cause**: `REQUIRE_TENANT=True` in production but no tenant provided

**Solution**: Provide `X-Tenant-ID` header or configure `DEFAULT_TENANT_ID`

### Issue: No Data Returned

**Cause**: Tenant context not set or RLS filtering data

**Solution**: 
1. Check middleware is enabled
2. Verify `X-Tenant-ID` header is correct
3. Check RLS policies with: `SELECT * FROM pg_policies;`

### Issue: Theme-Sync Fails

**Cause**: `TENANT_ID` environment variable not set

**Solution**: Set `TENANT_ID` in `docker-compose.dev.yml`

### Issue: Cannot Create Objects

**Cause**: Tenant context missing in API request

**Solution**: 
1. Ensure middleware sets `request.tenant`
2. Check API views have tenant validation
3. Verify `perform_create` sets tenant on objects

## Future Enhancements

1. **User-Tenant Association** - Link users to specific tenants
2. **Multi-Tenant Users** - Users with access to multiple tenants
3. **Tenant Switching** - UI to switch between tenants
4. **Tenant Quotas** - Limits on storage, pages, etc.
5. **Tenant Analytics** - Usage metrics per tenant
6. **Tenant Backup/Restore** - Per-tenant data export/import

## References

- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Django Multi-Tenancy](https://books.agiliq.com/projects/django-multi-tenant/en/latest/)
- [Django Middleware](https://docs.djangoproject.com/en/4.2/topics/http/middleware/)
