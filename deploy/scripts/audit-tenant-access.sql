-- Read-only pre-migration audit for the planned tenant membership backfill.
-- Reports aggregate counts only; no user identifiers or personal data.

BEGIN TRANSACTION READ ONLY;

WITH default_tenant AS (
    SELECT id, created_by_id
    FROM core_tenant
    WHERE is_active
    ORDER BY
        CASE WHEN identifier = 'default' THEN 0 ELSE 1 END,
        created_at,
        id
    LIMIT 1
),
audit AS (
    SELECT
        EXISTS (SELECT 1 FROM default_tenant) AS default_tenant_found,
        (SELECT COUNT(*) FROM auth_user WHERE is_active) AS active_users,
        (SELECT COUNT(*) FROM auth_user WHERE is_active AND is_staff) AS active_staff_users,
        (SELECT COUNT(*) FROM core_tenant WHERE is_active) AS active_tenants,
        (
            SELECT COUNT(*)
            FROM auth_user AS users
            CROSS JOIN default_tenant AS tenant
            WHERE users.is_active
              AND NOT users.is_staff
              AND users.id <> tenant.created_by_id
        ) AS potential_default_tenant_lockouts,
        GREATEST(
            (SELECT COUNT(*) FROM core_tenant WHERE is_active)
            - CASE WHEN EXISTS (SELECT 1 FROM default_tenant) THEN 1 ELSE 0 END,
            0
        ) AS non_default_tenants_requiring_mapping
)
SELECT
    active_users,
    active_staff_users,
    active_tenants,
    potential_default_tenant_lockouts,
    non_default_tenants_requiring_mapping,
    CASE
        WHEN NOT default_tenant_found THEN 'REVIEW_REQUIRED'
        WHEN potential_default_tenant_lockouts > 0 THEN 'RISK'
        WHEN non_default_tenants_requiring_mapping > 0 THEN 'REVIEW_REQUIRED'
        ELSE 'NO_RISK'
    END AS result
FROM audit;

ROLLBACK;
