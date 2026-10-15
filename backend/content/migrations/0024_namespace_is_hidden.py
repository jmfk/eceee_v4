from django.db import migrations, models


def mark_theme_media_hidden(apps, schema_editor):
    Namespace = apps.get_model("content", "Namespace")
    Namespace.objects.filter(kind="theme_media").update(is_hidden=True, is_default=False)


class Migration(migrations.Migration):
    dependencies = [("content", "0023_merge_namespace_migrations")]

    operations = [
        migrations.AddField(
            model_name="namespace",
            name="is_hidden",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Hide this namespace from ordinary user-facing namespace and media views",
            ),
        ),
        migrations.RunPython(mark_theme_media_hidden, migrations.RunPython.noop),
    ]
