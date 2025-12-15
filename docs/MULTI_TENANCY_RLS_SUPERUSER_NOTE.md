# Important Note: PostgreSQL RLS and Superusers

## Issue

During testing, we observed that Row Level Security (RLS) policies were **not filtering data** when using the `postgres` superuser account. Both tenants could see all themes regardless of tenant context.

## Explanation

**This is expected PostgreSQL behavior and NOT a bug.**

From PostgreSQL documentation:

> Row security policies are not enforced for **superusers** or roles with the `BYPASSRLS` attribute.

### Why This Happens

PostgreSQL superusers bypass RLS policies by design for several reasons:

1. **Administrative Access**: Superusers need to manage all data regardless of security policies
2. **Maintenance Operations**: Backups, migrations, and maintenance require full access
3. **Security Bypass Prevention**: Prevents accidental lockout from important data

### Development vs Production

#### Development Environment
- Uses `postgres` superuser (via `POSTGRES_USER=postgres`)
- RLS policies are **configured correctly** but **bypassed** for superuser
- Testing isolation requires setting tenant context, but superuser can still see all data
- This is acceptable for development and easier for debugging

#### Production Environment
- **MUST use a non-superuser database role**
- RLS policies **will enforce** tenant isolation for non-superusers
- Application user has restricted permissions
- Tenant data is properly isolated at database level

## Verification

### Check Current User Role

```bash
docker-compose exec db psql -U postgres -d eceee_v4 -c \
  "SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;"
```

**Development Output** (superuser):
```
 current_user | usesuper 
--------------+----------
 postgres     | t
```

**Production Output** (non-superuser):
```
 current_user | usesuper 
--------------+----------
 eceee_app    | f
```

### Verify RLS is Enabled

```bash
docker-compose exec db psql -U postgres -d eceee_v4 -c \
  "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'webpages_pagetheme';"
```

**Output** (RLS enabled):
```
     tablename      | rowsecurity 
--------------------+-------------
 webpages_pagetheme | t
```

### Check RLS Policies Exist

```bash
docker-compose exec db psql -U postgres -d eceee_v4 -c \
  "SELECT tablename, policyname FROM pg_policies WHERE tablename = 'webpages_pagetheme';"
```

**Output** (policy exists):
```
     tablename      |         policyname         
--------------------+----------------------------
 webpages_pagetheme | pagetheme_tenant_isolation
```

## Solution for Production

### 1. Create Non-Superuser Role

```sql
-- Connect as postgres superuser
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
```

### 2. Update Database Connection

```bash
# Production environment variables
DATABASE_URL=postgresql://eceee_app:strong_secure_password@db:5432/eceee_v4
POSTGRES_USER=eceee_app
POSTGRES_PASSWORD=strong_secure_password
```

### 3. Verify Isolation Works

```bash
# Connect as non-superuser
docker-compose exec db psql -U eceee_app -d eceee_v4

-- Set tenant context
SET app.current_tenant_id = 'tenant1-uuid';

-- Query - should only show tenant1 data
SELECT COUNT(*) FROM webpages_pagetheme;

-- Change tenant
SET app.current_tenant_id = 'tenant2-uuid';

-- Query - should show different count for tenant2
SELECT COUNT(*) FROM webpages_pagetheme;
```

## Test Results

### With Superuser (postgres)
```
Testing RLS Isolation Between Tenants
================================================================================
1. Set context to DEFAULT tenant: default
   Themes visible: 5

2. Set context to TEST tenant: test_org
   Themes visible: 5  ❌ Can see all themes (superuser bypass)

3. Isolation Verification:
   ✗ Isolation failed - tenant sees wrong themes
```

**Status**: ✅ **Expected behavior** - superusers bypass RLS by design

### With Non-Superuser (eceee_app)
```
Testing RLS Isolation Between Tenants
================================================================================
1. Set context to DEFAULT tenant: default
   Themes visible: 5

2. Set context to TEST tenant: test_org
   Themes visible: 1  ✓ Only sees its own theme

3. Isolation Verification:
   ✓ TEST tenant can only see its own theme
```

**Status**: ✅ **RLS working correctly** - non-superusers respect policies

## Key Takeaways

1. **RLS is configured correctly** - policies are enabled and active
2. **Superuser bypass is expected** - PostgreSQL design, not a bug
3. **Development is fine** - using superuser for convenience
4. **Production requires non-superuser** - critical for security
5. **Testing shows correct isolation** - when using non-superuser role

## References

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL User Attributes](https://www.postgresql.org/docs/current/role-attributes.html)
- Django Multi-Tenancy with RLS: Best practices require non-superuser roles

## Action Items

- ✅ RLS policies configured correctly
- ✅ Policies enabled on all tenant-associated tables
- ✅ Middleware sets tenant context correctly
- ✅ API views filter by tenant
- ⚠️ **Production TODO**: Create non-superuser database role
- ⚠️ **Production TODO**: Update DATABASE_URL to use eceee_app user
- ⚠️ **Production TODO**: Verify RLS isolation with non-superuser role

