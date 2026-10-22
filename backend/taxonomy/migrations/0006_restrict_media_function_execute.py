from django.db import migrations


def restrict_execute(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("REVOKE EXECUTE ON FUNCTION taxonomy_check_media(text, uuid) FROM PUBLIC")
        schema_editor.execute("REVOKE EXECUTE ON FUNCTION taxonomy_media_constraint() FROM PUBLIC")


class Migration(migrations.Migration):
    dependencies = [("taxonomy", "0005_mandatory_media_constraints")]
    # Keep these internal routines private even when rolling back this migration.
    operations = [migrations.RunPython(restrict_execute, migrations.RunPython.noop)]
