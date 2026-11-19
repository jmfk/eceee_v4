\set ON_ERROR_STOP on
CREATE TABLE public.core_tenant(id uuid PRIMARY KEY);
CREATE TABLE public.auth_user(id integer PRIMARY KEY);
INSERT INTO public.core_tenant VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO public.auth_user VALUES(1),(2);
CREATE ROLE modules_test NOSUPERUSER NOBYPASSRLS NOLOGIN;
\i /tmp/001_modules.sql
\i /tmp/001_modules.sql
GRANT USAGE ON SCHEMA modules TO modules_test;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA modules TO modules_test;
SET ROLE modules_test;
BEGIN;
SELECT set_config('app.tenant_id','10000000-0000-0000-0000-000000000001',true);
INSERT INTO modules.organizations VALUES ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Example organization');
INSERT INTO modules.memberships VALUES ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,now()+interval '1 year',true);
INSERT INTO modules.grants(tenant_id,id,organization_id,access_key,source,source_id) VALUES
('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','report:example','organization','50000000-0000-0000-0000-000000000001');
INSERT INTO modules.grants(tenant_id,id,user_id,access_key,source,source_id,starts_at,ends_at) VALUES
('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',2,'report:example','admin','50000000-0000-0000-0000-000000000002',now()-interval '2 days',now()-interval '1 day');
DO $$ BEGIN
  IF (SELECT count(*) FROM modules.grants WHERE NOT revoked AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
    AND (user_id=1 OR organization_id IN (SELECT organization_id FROM modules.memberships WHERE user_id=1 AND active AND (valid_until IS NULL OR valid_until>now())))) <> 1 THEN
    RAISE EXCEPTION 'organization access failed';
  END IF;
  IF EXISTS (SELECT 1 FROM modules.grants WHERE NOT revoked AND (ends_at IS NULL OR ends_at>now()) AND user_id=2) THEN
    RAISE EXCEPTION 'expired grant authorized';
  END IF;
END $$;
INSERT INTO modules.webhook_events(tenant_id,mode,id) VALUES('10000000-0000-0000-0000-000000000001','test','evt_duplicate') ON CONFLICT DO NOTHING;
INSERT INTO modules.webhook_events(tenant_id,mode,id) VALUES('10000000-0000-0000-0000-000000000001','test','evt_duplicate') ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM modules.webhook_events) <> 1 THEN RAISE EXCEPTION 'duplicate event'; END IF;
END $$;
SAVEPOINT failure;
INSERT INTO modules.webhook_events(tenant_id,mode,id) VALUES('10000000-0000-0000-0000-000000000001','test','evt_failed');
ROLLBACK TO failure;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM modules.webhook_events WHERE id='evt_failed') THEN RAISE EXCEPTION 'event committed without projection'; END IF;
END $$;
COMMIT;
-- Transaction-local context cannot leak into the next pooled request.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM modules.organizations) THEN RAISE EXCEPTION 'context leaked'; END IF; END $$;
BEGIN;
SELECT set_config('app.tenant_id','10000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM modules.organizations) THEN RAISE EXCEPTION 'cross-tenant read'; END IF;
  BEGIN
    INSERT INTO modules.config(tenant_id,commerce) VALUES('10000000-0000-0000-0000-000000000001',true);
    RAISE EXCEPTION 'cross-tenant write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO modules.memberships VALUES('10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',2,null,true);
    RAISE EXCEPTION 'cross-tenant foreign key accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
COMMIT;
\echo Module SQL invariants: passed
