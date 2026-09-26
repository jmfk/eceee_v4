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
        ("object_storage", "0022_alter_objectinstance_metadata_and_more"),
    ]

    operations = [
        migrations.RunPython(add_updated_at_column_if_missing, migrations.RunPython.noop),
    ]
