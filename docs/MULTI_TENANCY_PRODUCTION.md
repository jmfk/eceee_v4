# Multi-Tenancy Production Deployment Guide

This guide covers deploying the multi-tenancy system to production environments.

## Pre-Deployment Checklist

### 1. Database Configuration

#### Create Non-Superuser Database Role

**⚠️ CRITICAL**: PostgreSQL superusers bypass RLS policies. Production must use a non-superuser role.

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create dedicated application user
CREATE USER eceee_app WITH PASSWORD 'strong_secure_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE eceee_v4 TO eceee_app;
GRANT USAGE ON SCHEMA public TO eceee_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eceee_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eceee_app;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eceee_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO eceee_app;

-- Verify user is NOT a superuser
SELECT usename, usesuper FROM pg_user WHERE usename = 'eceee_app';
-- Should show: eceee_app | f
```

#### Update Database Connection

Update your production environment variables:

```bash
# Production .env or environment
DATABASE_URL=postgresql://eceee_app:strong_secure_password@db:5432/eceee_v4
POSTGRES_USER=eceee_app
POSTGRES_PASSWORD=strong_secure_password
```

### 2. Django Settings

Update `backend/config/settings.py` or production environment:

```python
# Production settings
DEBUG = False
REQUIRE_TENANT = True  # Enforce X-Tenant-ID header
DEFAULT_TENANT_ID = None  # No fallback in production
TENANT_HEADER = "X-Tenant-ID"

# Security
SECRET_KEY = os.getenv("SECRET_KEY")  # Use strong secret key
ALLOWED_HOSTS = ["your-domain.com", "www.your-domain.com"]
CSRF_TRUSTED_ORIGINS = ["https://your-domain.com"]
```

**Environment Variables**:
```bash
# Required
SECRET_KEY=your-production-secret-key-minimum-50-characters-long
REQUIRE_TENANT=True
DEBUG=False

# Optional
DEFAULT_TENANT_ID=  # Leave empty to require X-Tenant-ID header
```

### 3. Tenant Setup

#### Create Production Tenants

```bash
# Create tenants for your organizations
docker-compose exec backend python manage.py create_tenant \
    --name "Production Organization" \
    --identifier prod_org \
    --created-by admin

# List all tenants
docker-compose exec backend python manage.py shell -c "
from core.models import Tenant
for t in Tenant.objects.all():
    print(f'{t.identifier}: {t.name} (ID: {t.id}, Active: {t.is_active})')
"
```

#### Configure Tenant for Each Service

**Backend**: Tenant from `X-Tenant-ID` header (set by API client)

**Theme-Sync**: Set per tenant:
```yaml
# docker-compose.prod.yml
theme-sync-prod:
  environment:
    - TENANT_ID=prod_org
    - BACKEND_URL=https://api.your-domain.com
    - API_TOKEN=${THEME_SYNC_API_TOKEN}
```

### 4. API Client Configuration

All API clients must send `X-Tenant-ID` header:

**JavaScript**:
```javascript
const response = await fetch('https://api.your-domain.com/api/v1/webpages/pages/', {
  headers: {
    'X-Tenant-ID': 'prod_org',
    'Authorization': 'Token your-api-token'
  }
});
```

**Python**:
```python
import requests

response = requests.get(
    'https://api.your-domain.com/api/v1/webpages/pages/',
    headers={
        'X-Tenant-ID': 'prod_org',
        'Authorization': 'Token your-api-token'
    }
)
```

**cURL**:
```bash
curl -H "X-Tenant-ID: prod_org" \
     -H "Authorization: Token your-api-token" \
     https://api.your-domain.com/api/v1/webpages/pages/
```

### 5. Frontend Configuration

Update frontend to include tenant header in all API requests:

**React/Axios**:
```javascript
// src/api/client.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'X-Tenant-ID': process.env.REACT_APP_TENANT_ID || 'prod_org',
  }
});

export default apiClient;
```

**.env.production**:
```bash
REACT_APP_API_URL=https://api.your-domain.com/api/v1
REACT_APP_TENANT_ID=prod_org
```

## Deployment Process

### 1. Backup Current Database

```bash
# Backup before deployment
docker-compose exec db pg_dump -U postgres eceee_v4 > backup-$(date +%Y%m%d).sql
```

### 2. Run Migrations

```bash
# Apply all migrations
docker-compose exec backend python manage.py migrate

# Verify RLS is enabled
docker-compose exec db psql -U postgres -d eceee_v4 -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('webpages_pagetheme', 'webpages_webpage', 'content_namespace', 
                    'content_category', 'content_tag', 'object_storage_objectinstance', 
                    'file_manager_mediafile')
ORDER BY tablename;
"
```

### 3. Verify RLS Isolation

**Test with non-superuser**:
```bash
# Connect as app user (not superuser)
docker-compose exec db psql -U eceee_app -d eceee_v4

-- Set tenant context
SET app.current_tenant_id = 'your-tenant-uuid';

-- Query should only return this tenant's data
SELECT COUNT(*) FROM webpages_pagetheme;

-- Change tenant context
SET app.current_tenant_id = 'different-tenant-uuid';

-- Should return different count
SELECT COUNT(*) FROM webpages_pagetheme;
```

### 4. Update Middleware Order

Verify middleware is correctly ordered in `settings.py`:

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantContextMiddleware',  # After auth, before other DB queries
    # ... rest of middleware
]
```

### 5. Deploy Services

```bash
# Pull latest code
git pull origin main

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Post-Deployment Verification

### 1. Test Tenant Isolation

```bash
# Create test data for two tenants
TENANT1_ID=$(docker-compose exec backend python manage.py shell -c "
from core.models import Tenant
print(Tenant.objects.get(identifier='tenant1').id)
")

TENANT2_ID=$(docker-compose exec backend python manage.py shell -c "
from core.models import Tenant
print(Tenant.objects.get(identifier='tenant2').id)
")

# Test API with tenant1
curl -H "X-Tenant-ID: $TENANT1_ID" \
     -H "Authorization: Token your-token" \
     https://api.your-domain.com/api/v1/webpages/themes/ \
     | jq '.count'

# Test API with tenant2 (should return different count)
curl -H "X-Tenant-ID: $TENANT2_ID" \
     -H "Authorization: Token your-token" \
     https://api.your-domain.com/api/v1/webpages/themes/ \
     | jq '.count'
```

### 2. Test Missing Tenant Header

```bash
# Should return 403 Forbidden (REQUIRE_TENANT=True)
curl -H "Authorization: Token your-token" \
     https://api.your-domain.com/api/v1/webpages/themes/
```

### 3. Verify RLS Policies

```bash
docker-compose exec db psql -U eceee_app -d eceee_v4 -c "
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
"
```

### 4. Monitor Logs

```bash
# Backend logs
docker-compose logs -f backend | grep -i tenant

# Database logs (if logging enabled)
docker-compose logs -f db | grep -i "row security"
```

## Security Considerations

### 1. Database User Permissions

**✅ DO**:
- Use non-superuser database role in production
- Grant only necessary permissions
- Use strong passwords
- Rotate passwords regularly

**❌ DON'T**:
- Use postgres superuser (bypasses RLS)
- Grant superuser privileges to application user
- Use same password across environments

### 2. Tenant Context

**✅ DO**:
- Always set `REQUIRE_TENANT=True` in production
- Validate `X-Tenant-ID` header in API clients
- Log tenant switches for audit trail
- Monitor cross-tenant access attempts

**❌ DON'T**:
- Allow requests without `X-Tenant-ID` in production
- Use `DEFAULT_TENANT_ID` in production
- Trust tenant ID from user input (use session/auth)

### 3. API Security

**✅ DO**:
- Use HTTPS in production
- Implement rate limiting per tenant
- Log all API requests with tenant ID
- Monitor for suspicious cross-tenant access patterns

**❌ DON'T**:
- Expose tenant UUIDs in URLs
- Allow tenant enumeration
- Trust client-provided tenant IDs without auth

## Monitoring & Maintenance

### 1. Monitor RLS Performance

```sql
-- Check query performance with RLS
EXPLAIN ANALYZE
SELECT * FROM webpages_pagetheme 
WHERE tenant_id = current_setting('app.current_tenant_id')::uuid;

-- Monitor slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%tenant_id%' 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 2. Audit Tenant Access

```python
# Add to middleware or views
import logging

logger = logging.getLogger('tenant_audit')

def log_tenant_access(request, action, resource):
    logger.info(
        f"Tenant Access: {action} on {resource}",
        extra={
            'tenant_id': request.tenant.id if request.tenant else None,
            'tenant_identifier': request.tenant.identifier if request.tenant else None,
            'user': request.user.username,
            'ip': request.META.get('REMOTE_ADDR'),
            'action': action,
            'resource': resource,
        }
    )
```

### 3. Backup Strategy

**Per-Tenant Backups**:
```bash
# Backup single tenant's data
docker-compose exec backend python manage.py shell -c "
from core.models import Tenant
from core.rls import set_tenant_context
from django.core import serializers
import json

tenant = Tenant.objects.get(identifier='prod_org')
set_tenant_context(tenant.id)

# Export tenant data
from webpages.models import PageTheme, WebPage
themes = PageTheme.objects.all()
pages = WebPage.objects.all()

backup = {
    'tenant': tenant.identifier,
    'themes': [t.to_dict() for t in themes],
    'pages': [p.to_dict() for p in pages],
}

with open(f'backup-{tenant.identifier}.json', 'w') as f:
    json.dump(backup, f, indent=2)
"
```

## Rollback Plan

If issues occur after deployment:

### 1. Quick Rollback

```bash
# Stop services
docker-compose down

# Restore database backup
docker-compose exec db psql -U postgres eceee_v4 < backup-YYYYMMDD.sql

# Checkout previous version
git checkout previous-stable-tag

# Restart services
docker-compose up -d
```

### 2. Disable Tenant Requirement

If urgent fix needed:

```bash
# Temporarily allow requests without tenant
docker-compose exec backend python manage.py shell -c "
from django.conf import settings
# Update environment or settings
"

# In .env or docker-compose
REQUIRE_TENANT=False
DEFAULT_TENANT_ID=your-default-tenant-uuid
```

### 3. Disable RLS (Emergency Only)

**⚠️ WARNING**: Only as last resort, temporarily disables tenant isolation:

```sql
-- Connect as superuser
ALTER TABLE webpages_pagetheme DISABLE ROW LEVEL SECURITY;
ALTER TABLE webpages_webpage DISABLE ROW LEVEL SECURITY;
-- etc. for other tables
```

**Re-enable immediately after fix**:
```sql
ALTER TABLE webpages_pagetheme ENABLE ROW LEVEL SECURITY;
ALTER TABLE webpages_webpage ENABLE ROW LEVEL SECURITY;
```

## Production Checklist

- [ ] Database user is non-superuser (verified with `SELECT usesuper FROM pg_user`)
- [ ] `REQUIRE_TENANT=True` in production settings
- [ ] `DEFAULT_TENANT_ID` is empty/None in production
- [ ] `DEBUG=False` in production
- [ ] All API clients send `X-Tenant-ID` header
- [ ] Frontend includes tenant ID in all requests
- [ ] Theme-sync configured with correct `TENANT_ID`
- [ ] RLS enabled on all tenant-associated tables (verified with `\d+ table_name`)
- [ ] RLS policies created and active (verified with `SELECT * FROM pg_policies`)
- [ ] Tenant isolation tested with multiple tenants
- [ ] Missing tenant header returns 403 Forbidden
- [ ] Cross-tenant access blocked (tested with 2+ tenants)
- [ ] Backups configured and tested
- [ ] Monitoring and logging in place
- [ ] Rollback plan documented and tested

## Support & Troubleshooting

### Common Issues

**Issue**: RLS not filtering data
- **Cause**: Using superuser database role
- **Fix**: Create and use non-superuser role (see Database Configuration)

**Issue**: 403 Forbidden errors
- **Cause**: `REQUIRE_TENANT=True` but no `X-Tenant-ID` header
- **Fix**: Ensure all clients send tenant header

**Issue**: Wrong tenant data visible
- **Cause**: Incorrect tenant ID in header
- **Fix**: Verify tenant UUID/identifier matches database

**Issue**: Performance degradation
- **Cause**: RLS policies causing slow queries
- **Fix**: Add indexes on `tenant_id` columns, optimize queries

For more information, see:
- `docs/MULTI_TENANCY.md` - Complete multi-tenancy documentation
- `docs/MULTI_TENANCY_TEST_RESULTS.md` - Test results and verification
- `docs/MULTI_TENANCY_IMPLEMENTATION_STATUS.md` - Implementation status

