from django.db import migrations


def reset_namespace_id_sequence(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('content_namespace', 'id'),
                COALESCE((SELECT MAX(id) FROM content_namespace), 1),
                true
            )
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0020_make_tenant_required_on_content"),
    ]

    operations = [
        migrations.RunPython(reset_namespace_id_sequence, migrations.RunPython.noop),
    ]
