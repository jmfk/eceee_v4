"""Serialize required-tag checks and validate allowed uses on new media links."""

import importlib

from django.db import migrations


def check_function(*, lock):
    source = importlib.import_module("taxonomy.migrations.0005_mandatory_media_constraints").SQL
    function = source[: source.index("CREATE FUNCTION taxonomy_media_constraint")]
    function = function.replace(
        "CREATE FUNCTION taxonomy_check_media", "CREATE OR REPLACE FUNCTION taxonomy_check_media"
    )
    function = function.replace(
        "t.status NOT IN ('approved','archived','merged')", "NOT taxonomy_valid_media_term(t.id,ns,owner_tenant)"
    )
    if lock:
        # Serialize resource checks without conflicting with join-table FK locks.
        function = function.replace("WHERE id=resource;", "WHERE id=resource FOR NO KEY UPDATE;")
        function = function.replace("WHERE c.id=resource;", "WHERE c.id=resource FOR NO KEY UPDATE OF c;")
    return function


SQL = """
CREATE FUNCTION taxonomy_check_new_media_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ns bigint; use_name text; term_id uuid; target uuid; definition_id uuid; term_status text; depth integer := 0;
BEGIN
 IF TG_TABLE_NAME='taxonomy_mediafileclassification' THEN
  IF TG_OP='UPDATE' AND OLD.media_file_id=NEW.media_file_id AND OLD.tag_id=NEW.tag_id THEN RETURN NEW; END IF;
  SELECT namespace_id INTO ns FROM file_manager_mediafile WHERE id=NEW.media_file_id;
  use_name := 'media_files';
 ELSE
  IF TG_OP='UPDATE' AND OLD.collection_id=NEW.collection_id AND OLD.tag_id=NEW.tag_id THEN RETURN NEW; END IF;
  SELECT namespace_id INTO ns FROM file_manager_mediacollection WHERE id=NEW.collection_id;
  use_name := 'media_collections';
 END IF;
 -- Lock each redirect hop before reading its metadata. FK KEY SHARE alone does
 -- not conflict with a concurrent status change; FOR SHARE does.
 term_id := NEW.tag_id;
 LOOP
  SELECT merged_into_id,classification_type_id,status INTO target,definition_id,term_status
   FROM taxonomy_tag WHERE id=term_id FOR SHARE;
  EXIT WHEN NOT FOUND;
  PERFORM id FROM taxonomy_classificationtype WHERE id=definition_id FOR SHARE;
  EXIT WHEN term_status<>'merged' OR target IS NULL OR depth>=100;
  term_id := target;
  depth := depth+1;
 END LOOP;
 IF EXISTS(SELECT 1 FROM taxonomy_classificationrollout WHERE namespace_id=ns AND phase='canonical')
  AND NOT EXISTS(SELECT 1 FROM taxonomy_tag t JOIN taxonomy_classificationtype d ON d.id=t.classification_type_id
   WHERE t.id=NEW.tag_id AND d.allowed_uses ? use_name)
 THEN RAISE EXCEPTION 'Classification type is unavailable for this media kind' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER taxonomy_file_new_assignment BEFORE INSERT OR UPDATE ON taxonomy_mediafileclassification
 FOR EACH ROW EXECUTE FUNCTION taxonomy_check_new_media_link();
CREATE TRIGGER taxonomy_collection_new_assignment BEFORE INSERT OR UPDATE ON taxonomy_mediacollectionclassification
 FOR EACH ROW EXECUTE FUNCTION taxonomy_check_new_media_link();
REVOKE ALL ON FUNCTION taxonomy_check_new_media_link() FROM PUBLIC;
"""

REVERSE = """
DROP TRIGGER IF EXISTS taxonomy_file_new_assignment ON taxonomy_mediafileclassification;
DROP TRIGGER IF EXISTS taxonomy_collection_new_assignment ON taxonomy_mediacollectionclassification;
DROP FUNCTION IF EXISTS taxonomy_check_new_media_link();
"""


def apply(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(check_function(lock=True))
        schema_editor.execute(SQL)


def reverse(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REVERSE)
        schema_editor.execute(check_function(lock=False))


class Migration(migrations.Migration):
    dependencies = [("taxonomy", "0007_guard_redirects_and_activation")]
    operations = [migrations.RunPython(apply, reverse)]
