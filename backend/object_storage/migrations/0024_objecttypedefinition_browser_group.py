from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("object_storage", "0023_ensure_objectversion_updated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="objecttypedefinition",
            name="browser_group",
            field=models.ForeignKey(
                blank=True,
                help_text="Main object type under which this type is grouped in the object browser",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="supporting_browser_types",
                to="object_storage.objecttypedefinition",
            ),
        ),
    ]
