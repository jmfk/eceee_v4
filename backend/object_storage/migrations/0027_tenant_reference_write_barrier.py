from django.db import migrations

CREATE_BARRIER_SQL = """
CREATE OR REPLACE FUNCTION object_storage_lock_tenant_reference_write()
RETURNS trigger AS $$
DECLARE
    target_tenant_id uuid;
    parent_tenant_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'object_storage_objectinstance' THEN
        target_tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
        IF TG_OP <> 'DELETE' AND NEW.parent_id IS NOT NULL THEN
            SELECT tenant_id INTO parent_tenant_id
            FROM object_storage_objectinstance
            WHERE id = NEW.parent_id;
            IF parent_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
                RAISE EXCEPTION 'Object parent must belong to the same tenant';
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'object_storage_objectversion' THEN
        SELECT tenant_id INTO target_tenant_id
        FROM object_storage_objectinstance
        WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.object_instance_id ELSE NEW.object_instance_id END;
    ELSIF TG_TABLE_NAME = 'webpages_pageversion' THEN
        SELECT tenant_id INTO target_tenant_id
        FROM webpages_webpage
        WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.page_id ELSE NEW.page_id END;
    END IF;

    IF target_tenant_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('object-transfer:' || target_tenant_id::text, 0));
    END IF;
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('object-reference-write', 0));
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION object_storage_lock_tenant_reference_write() FROM PUBLIC;

CREATE TRIGGER objectinstance_tenant_reference_write_barrier
BEFORE INSERT OR UPDATE OR DELETE ON object_storage_objectinstance
FOR EACH ROW EXECUTE FUNCTION object_storage_lock_tenant_reference_write();

CREATE TRIGGER objectversion_tenant_reference_write_barrier
BEFORE INSERT OR UPDATE OR DELETE ON object_storage_objectversion
FOR EACH ROW EXECUTE FUNCTION object_storage_lock_tenant_reference_write();

CREATE TRIGGER pageversion_tenant_reference_write_barrier
BEFORE INSERT OR UPDATE OR DELETE ON webpages_pageversion
FOR EACH ROW EXECUTE FUNCTION object_storage_lock_tenant_reference_write();
"""


DROP_BARRIER_SQL = """
DROP TRIGGER IF EXISTS pageversion_tenant_reference_write_barrier ON webpages_pageversion;
DROP TRIGGER IF EXISTS objectversion_tenant_reference_write_barrier ON object_storage_objectversion;
DROP TRIGGER IF EXISTS objectinstance_tenant_reference_write_barrier ON object_storage_objectinstance;
DROP FUNCTION IF EXISTS object_storage_lock_tenant_reference_write();
"""


def create_reference_write_barrier(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(CREATE_BARRIER_SQL)


def drop_reference_write_barrier(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(DROP_BARRIER_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("object_storage", "0026_transfercheckpoint"),
        ("webpages", "0084_themeremoteconnection_credential_scheme"),
    ]

    operations = [
        migrations.RunPython(create_reference_write_barrier, drop_reference_write_barrier),
    ]
