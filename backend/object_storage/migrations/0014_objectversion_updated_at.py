# Generated migration to add updated_at field to model state.
#
# Some existing databases already had the column before this migration was
# introduced. Clean databases do not, so the database operation must add it
# only when it is missing.

from django.db import migrations, models


def add_updated_at_column_if_missing(apps, schema_editor):
    ObjectVersion = apps.get_model("object_storage", "ObjectVersion")
    table_name = ObjectVersion._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

    if "updated_at" in columns:
        return

    field = models.DateTimeField(auto_now=True)
    field.set_attributes_from_name("updated_at")
    schema_editor.add_field(ObjectVersion, field)


class Migration(migrations.Migration):
    dependencies = [
        (
            "object_storage",
            "0013_remove_objectversion_object_stor_effecti_idx_and_more",
        ),
    ]

    operations = [
        # Use SeparateDatabaseAndState to only update model state without DB operations
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="objectversion",
                    name="updated_at",
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_updated_at_column_if_missing, migrations.RunPython.noop),
            ],
        ),
    ]
