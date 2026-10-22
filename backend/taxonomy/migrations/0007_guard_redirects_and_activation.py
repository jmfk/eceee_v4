from django.db import migrations

SQL = r"""
CREATE FUNCTION taxonomy_valid_media_term(term uuid, ns bigint, owner_tenant uuid) RETURNS boolean LANGUAGE sql
 STABLE AS $$
 WITH RECURSIVE chain AS (
  SELECT t.id,t.merged_into_id,t.status,t.tag_type,0 AS depth FROM taxonomy_tag t
   JOIN taxonomy_classificationtype d ON d.id=t.classification_type_id
   WHERE t.id=term AND t.namespace_id=ns AND t.tenant_id=owner_tenant AND d.namespace_id=ns AND
 d.tenant_id=owner_tenant AND d.key=t.tag_type
  UNION ALL
  SELECT t.id,t.merged_into_id,t.status,t.tag_type,c.depth+1 FROM chain c JOIN taxonomy_tag t ON t.id=c.merged_into_id
   JOIN taxonomy_classificationtype d ON d.id=t.classification_type_id
   WHERE c.status='merged' AND c.depth<100 AND t.namespace_id=ns AND t.tenant_id=owner_tenant AND t.tag_type=c.tag_type
    AND d.namespace_id=ns AND d.tenant_id=owner_tenant AND d.key=t.tag_type
 ) SELECT EXISTS(SELECT 1 FROM chain WHERE status IN ('approved','archived'));
$$;
CREATE FUNCTION taxonomy_validate_changed_terms() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item record; ns bigint;
BEGIN
 IF TG_TABLE_NAME='taxonomy_classificationrollout' THEN
  ns:=NEW.namespace_id;
  FOR item IN SELECT id FROM file_manager_mediafile WHERE namespace_id=ns LOOP PERFORM
 taxonomy_check_media('file',item.id); END LOOP;
  FOR item IN SELECT id FROM file_manager_mediacollection WHERE namespace_id=ns LOOP PERFORM
 taxonomy_check_media('collection',item.id); END LOOP;
 ELSE
  FOR item IN
   WITH RECURSIVE affected AS (
    SELECT id FROM taxonomy_tag WHERE (TG_TABLE_NAME='taxonomy_tag' AND id=NEW.id)
      OR (TG_TABLE_NAME='taxonomy_classificationtype' AND classification_type_id=NEW.id)
    UNION SELECT t.id FROM taxonomy_tag t JOIN affected a ON t.merged_into_id=a.id
   ) SELECT DISTINCT 'file'::text AS kind,l.media_file_id AS id FROM taxonomy_mediafileclassification l WHERE
 l.tag_id IN (SELECT id FROM affected)
     UNION SELECT DISTINCT 'collection'::text,l.collection_id FROM taxonomy_mediacollectionclassification l WHERE
 l.tag_id IN (SELECT id FROM affected)
  LOOP PERFORM taxonomy_check_media(item.kind,item.id); END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER taxonomy_term_media_guard AFTER UPDATE ON taxonomy_tag DEFERRABLE INITIALLY DEFERRED FOR
 EACH ROW EXECUTE FUNCTION taxonomy_validate_changed_terms();
CREATE CONSTRAINT TRIGGER taxonomy_type_media_guard AFTER UPDATE ON taxonomy_classificationtype DEFERRABLE INITIALLY
 DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_validate_changed_terms();
CREATE CONSTRAINT TRIGGER taxonomy_activation_guard AFTER INSERT OR UPDATE ON taxonomy_classificationrollout
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION taxonomy_validate_changed_terms();
REVOKE ALL ON FUNCTION taxonomy_valid_media_term(uuid,bigint,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taxonomy_validate_changed_terms() FROM PUBLIC;

"""
REVERSE = """
DROP TRIGGER IF EXISTS taxonomy_term_media_guard ON taxonomy_tag;
DROP TRIGGER IF EXISTS taxonomy_type_media_guard ON taxonomy_classificationtype;
DROP TRIGGER IF EXISTS taxonomy_activation_guard ON taxonomy_classificationrollout;
DROP FUNCTION IF EXISTS taxonomy_validate_changed_terms();
DROP FUNCTION IF EXISTS taxonomy_valid_media_term(uuid,bigint,uuid);
"""


def apply(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(SQL)
        # Replace the validation predicate while preserving the proven deferred trigger layout.
        import importlib

        source = importlib.import_module("taxonomy.migrations.0005_mandatory_media_constraints").SQL
        function = source[: source.index("CREATE FUNCTION taxonomy_media_constraint")]
        function = function.replace(
            "CREATE FUNCTION taxonomy_check_media", "CREATE OR REPLACE FUNCTION taxonomy_check_media"
        )
        function = function.replace(
            "t.status NOT IN ('approved','archived','merged')", "NOT taxonomy_valid_media_term(t.id,ns,owner_tenant)"
        )
        schema_editor.execute(function)


def reverse(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        import importlib

        source = importlib.import_module("taxonomy.migrations.0005_mandatory_media_constraints").SQL
        function = source[: source.index("CREATE FUNCTION taxonomy_media_constraint")].replace(
            "CREATE FUNCTION taxonomy_check_media", "CREATE OR REPLACE FUNCTION taxonomy_check_media"
        )
        schema_editor.execute(function)
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [("taxonomy", "0006_restrict_media_function_execute")]
    operations = [migrations.RunPython(apply, reverse)]
