from django.db import migrations

SQL = r"""
CREATE FUNCTION taxonomy_check_media(kind text, resource uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE ns bigint; owner_tenant uuid; deleted boolean := false; link_count integer; bad_count integer;
BEGIN
 IF kind = 'file' THEN
  SELECT namespace_id, tenant_id, is_deleted INTO ns, owner_tenant, deleted FROM file_manager_mediafile WHERE id=resource;
 ELSE
  SELECT c.namespace_id,n.tenant_id INTO ns, owner_tenant FROM file_manager_mediacollection c JOIN content_namespace n ON n.id=c.namespace_id WHERE c.id=resource;
 END IF;
 IF ns IS NULL OR deleted OR NOT EXISTS(SELECT 1 FROM taxonomy_classificationrollout WHERE namespace_id=ns AND phase='canonical') THEN RETURN; END IF;
 IF kind='file' THEN
  SELECT count(*), count(*) FILTER(WHERE t.namespace_id<>ns OR t.tenant_id<>owner_tenant OR d.namespace_id<>ns OR d.tenant_id<>owner_tenant OR d.id IS NULL OR t.status NOT IN ('approved','archived','merged'))
   INTO link_count,bad_count FROM taxonomy_mediafileclassification a JOIN taxonomy_tag t ON t.id=a.tag_id LEFT JOIN taxonomy_classificationtype d ON d.id=t.classification_type_id WHERE a.media_file_id=resource;
 ELSE
  SELECT count(*), count(*) FILTER(WHERE t.namespace_id<>ns OR t.tenant_id<>owner_tenant OR d.namespace_id<>ns OR d.tenant_id<>owner_tenant OR d.id IS NULL OR t.status NOT IN ('approved','archived','merged'))
   INTO link_count,bad_count FROM taxonomy_mediacollectionclassification a JOIN taxonomy_tag t ON t.id=a.tag_id LEFT JOIN taxonomy_classificationtype d ON d.id=t.classification_type_id WHERE a.collection_id=resource;
 END IF;
 IF link_count=0 OR bad_count>0 THEN RAISE EXCEPTION 'Media requires at least one valid taxonomy classification in its namespace' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION taxonomy_media_constraint() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='file_manager_mediafile' THEN PERFORM taxonomy_check_media('file',NEW.id);
 ELSIF TG_TABLE_NAME='file_manager_mediacollection' THEN PERFORM taxonomy_check_media('collection',NEW.id);
 ELSIF TG_TABLE_NAME='taxonomy_mediafileclassification' THEN
  IF TG_OP<>'INSERT' THEN PERFORM taxonomy_check_media('file',OLD.media_file_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM taxonomy_check_media('file',NEW.media_file_id); END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM taxonomy_check_media('collection',OLD.collection_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM taxonomy_check_media('collection',NEW.collection_id); END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION taxonomy_check_media(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION taxonomy_media_constraint() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER taxonomy_file_required AFTER INSERT OR UPDATE ON file_manager_mediafile DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_media_constraint();
CREATE CONSTRAINT TRIGGER taxonomy_collection_required AFTER INSERT OR UPDATE ON file_manager_mediacollection DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_media_constraint();
CREATE CONSTRAINT TRIGGER taxonomy_file_assignment_required AFTER INSERT OR UPDATE OR DELETE ON taxonomy_mediafileclassification DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_media_constraint();
CREATE CONSTRAINT TRIGGER taxonomy_collection_assignment_required AFTER INSERT OR UPDATE OR DELETE ON taxonomy_mediacollectionclassification DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_media_constraint();
"""
REVERSE = """
DROP TRIGGER IF EXISTS taxonomy_file_required ON file_manager_mediafile;
DROP TRIGGER IF EXISTS taxonomy_collection_required ON file_manager_mediacollection;
DROP TRIGGER IF EXISTS taxonomy_file_assignment_required ON taxonomy_mediafileclassification;
DROP TRIGGER IF EXISTS taxonomy_collection_assignment_required ON taxonomy_mediacollectionclassification;
DROP FUNCTION IF EXISTS taxonomy_media_constraint();
DROP FUNCTION IF EXISTS taxonomy_check_media(text,uuid);
"""


def apply(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(SQL)


def reverse(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [('taxonomy', '0004_alter_legacytagmapping_source_kind_and_more')]
    operations = [migrations.RunPython(apply, reverse)]
