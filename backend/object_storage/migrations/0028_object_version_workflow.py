from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("object_storage", "0027_tenant_reference_write_barrier")]
    operations = [
        migrations.AddField(
            model_name="objectversion", name="title", field=models.CharField(blank=True, default="", max_length=255)
        ),
        migrations.AddField(
            model_name="objectversion", name="edit_revision", field=models.PositiveIntegerField(default=1)
        ),
        migrations.AddField(
            model_name="objectversion", name="workflow_metadata", field=models.JSONField(blank=True, default=dict)
        ),
    ]
