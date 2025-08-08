from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0023_webpage_enable_css_injection_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PageDataSchema",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "scope",
                    models.CharField(
                        choices=[("system", "System"), ("layout", "Layout")],
                        default="system",
                        max_length=20,
                    ),
                ),
                (
                    "layout_name",
                    models.CharField(
                        blank=True,
                        help_text="Name of the code-based layout this schema applies to (scope=layout)",
                        max_length=255,
                    ),
                ),
                (
                    "schema",
                    models.JSONField(help_text="JSON Schema draft-07+ definition"),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "name"],
            },
        ),
        migrations.AddIndex(
            model_name="pagedataschema",
            index=models.Index(
                fields=["scope", "layout_name", "is_active"],
                name="pds_scope_layout_active_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="pagedataschema",
            index=models.Index(fields=["is_active"], name="pds_active_idx"),
        ),
        migrations.AddConstraint(
            model_name="pagedataschema",
            constraint=models.UniqueConstraint(
                fields=("scope", "layout_name", "name"),
                name="unique_schema_per_scope_layout_name",
            ),
        ),
    ]
