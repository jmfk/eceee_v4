from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


def form_defaults(apps, schema_editor):
    # The constrained TypeScript writer does not receive INSERT access to moderation columns.
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE webpages_publicformsubmission ALTER COLUMN status SET DEFAULT 'pending'")
        schema_editor.execute("ALTER TABLE webpages_publicformsubmission ALTER COLUMN review_note SET DEFAULT ''")


def undo_form_defaults(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE webpages_publicformsubmission ALTER COLUMN status DROP DEFAULT")
        schema_editor.execute("ALTER TABLE webpages_publicformsubmission ALTER COLUMN review_note DROP DEFAULT")


class Migration(migrations.Migration):
    dependencies = [
        ("webpages", "0093_camel_case_slot_keys"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PagePathAlias",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(max_length=2048)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="previous_paths",
                        to="webpages.webpage",
                    ),
                ),
                (
                    "root",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="path_aliases", to="webpages.webpage"
                    ),
                ),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.tenant")),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("root", "path"), name="page_alias_root_path")]},
        ),
        migrations.AddField(
            "publicformsubmission",
            "status",
            models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("reviewing", "Reviewing"),
                    ("accepted", "Accepted"),
                    ("rejected", "Rejected"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField("publicformsubmission", "review_note", models.TextField(blank=True, default="")),
        migrations.AddField("publicformsubmission", "reviewed_at", models.DateTimeField(blank=True, null=True)),
        migrations.AddField(
            "publicformsubmission",
            "reviewed_by",
            models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.RunPython(form_defaults, undo_form_defaults),
    ]
