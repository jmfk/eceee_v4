import uuid

from django.db import migrations, models
import django.db.models.deletion
import webpages.models.theme_remote


def populate_page_stable_keys(apps, schema_editor):
    WebPage = apps.get_model("webpages", "WebPage")
    for page in WebPage.objects.filter(stable_key__isnull=True).iterator(chunk_size=500):
        page.stable_key = uuid.uuid4()
        page.save(update_fields=["stable_key"])


class Migration(migrations.Migration):
    dependencies = [("webpages", "0078_pageversion_edit_revision")]

    operations = [
        migrations.AddField(
            model_name="webpage",
            name="stable_key",
            field=models.UUIDField(db_index=True, editable=False, null=True),
        ),
        migrations.RunPython(populate_page_stable_keys, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="webpage",
            name="stable_key",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False),
        ),
        migrations.AddConstraint(
            model_name="webpage",
            constraint=models.UniqueConstraint(
                fields=("tenant", "stable_key"),
                name="unique_page_lineage_per_tenant",
            ),
        ),
        migrations.AddField(
            model_name="themeremoteaccesskey",
            name="capabilities",
            field=models.JSONField(blank=True, default=webpages.models.theme_remote.default_remote_capabilities),
        ),
        migrations.CreateModel(
            name="RemoteSiteBinding",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("remote_root_key", models.UUIDField()),
                ("page_map", models.JSONField(blank=True, default=dict)),
                ("theme_map", models.JSONField(blank=True, default=dict)),
                ("version_map", models.JSONField(blank=True, default=dict)),
                ("version_fingerprints", models.JSONField(blank=True, default=dict)),
                ("last_remote_exported_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "connection",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="site_bindings",
                        to="webpages.themeremoteconnection",
                    ),
                ),
                (
                    "local_root",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="remote_site_binding",
                        to="webpages.webpage",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="remote_site_bindings",
                        to="core.tenant",
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddConstraint(
            model_name="remotesitebinding",
            constraint=models.UniqueConstraint(
                fields=("connection", "remote_root_key", "local_root"),
                name="unique_remote_site_copy",
            ),
        ),
    ]
