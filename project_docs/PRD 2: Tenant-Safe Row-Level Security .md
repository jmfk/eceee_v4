# PRD 2: Tenant-Safe Row-Level Security (RLS)

## 1. Purpose

Ensure hard isolation between tenants at the database level. No API bug or developer mistake must allow:
- Cross-tenant reads
- Cross-tenant writes
- Cross-tenant search leakage

## 2. RLS Strategy

- One PostgreSQL role per application service.
- Tenant context injected per request.
- RLS enabled on all content and search tables.

## 3. Tenant Context Injection

Each DB session must set tenant context:

```sql
-- Use SET LOCAL within a transaction for safety with connection pooling.
SET LOCAL app.tenant_id = '<tenant-uuid>';
```

Alternative (equivalent, commonly used via drivers/middleware):

```sql
SELECT set_config('app.tenant_id', '<tenant-uuid>', true);
```

## 4. RLS Policies

### Enable RLS
```sql
ALTER TABLE webpages_webpage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webpages_pageversion ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_pageversion_index ENABLE ROW LEVEL SECURITY;

-- Recommended: prevent table owners from bypassing RLS.
ALTER TABLE webpages_webpage FORCE ROW LEVEL SECURITY;
ALTER TABLE webpages_pageversion FORCE ROW LEVEL SECURITY;
ALTER TABLE search_pageversion_index FORCE ROW LEVEL SECURITY;
```

### Web pages (`webpages_webpage`)
```sql
CREATE POLICY tenant_webpages ON webpages_webpage
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_webpages_write ON webpages_webpage
FOR INSERT, UPDATE
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Page versions (`webpages_pageversion`)
```sql
-- NOTE: `webpages_pageversion` does NOT have tenant_id in the current schema.
-- Enforce tenant isolation via the owning page row.
CREATE POLICY tenant_pageversions ON webpages_pageversion
USING (
  EXISTS (
    SELECT 1
    FROM webpages_webpage p
    WHERE p.id = webpages_pageversion.page_id
      AND p.tenant_id = current_setting('app.tenant_id')::uuid
  )
);

CREATE POLICY tenant_pageversions_write ON webpages_pageversion
FOR INSERT, UPDATE
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM webpages_webpage p
    WHERE p.id = webpages_pageversion.page_id
      AND p.tenant_id = current_setting('app.tenant_id')::uuid
  )
);
```

### Page search index (`search_pageversion_index`)
```sql
CREATE POLICY tenant_search_pageversions ON search_pageversion_index
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_search_pageversions_write ON search_pageversion_index
FOR INSERT, UPDATE
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

## 5. Enforcement Rules

- No bypass roles.
- No `SECURITY DEFINER` search functions.
- No shared materialized views.

## 6. Failure Handling

If `app.tenant_id` is missing:
- Query fails.
- No implicit fallback.
- This is intentional.

**Implementation note**: `current_setting('app.tenant_id')::uuid` throws when unset, which is the desired “fail closed” behavior.

## 7. Success Criteria

- Impossible to query another tenant even with raw SQL.
- Search indexes obey tenant boundaries.
- Auditable isolation guarantees.
