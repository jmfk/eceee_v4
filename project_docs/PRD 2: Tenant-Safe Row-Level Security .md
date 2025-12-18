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
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_search_index ENABLE ROW LEVEL SECURITY;

-- Recommended: prevent table owners from bypassing RLS.
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_search_index FORCE ROW LEVEL SECURITY;
```

### Documents
```sql
CREATE POLICY tenant_documents ON documents
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_documents_write ON documents
FOR INSERT, UPDATE
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Document Versions
```sql
CREATE POLICY tenant_versions ON document_versions
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_versions_write ON document_versions
FOR INSERT, UPDATE
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Search Index
```sql
CREATE POLICY tenant_search ON document_search_index
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_search_write ON document_search_index
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
