import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_tenant_members"),
        ("webpages", "0076_themeversion_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="PublicFormSubmission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("widget_id", models.CharField(max_length=255)),
                ("form_title", models.CharField(blank=True, default="", max_length=255)),
                ("data", models.JSONField(default=dict)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("page_version_id", models.PositiveBigIntegerField()),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="public_form_submissions",
                        to="webpages.webpage",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="public_form_submissions",
                        to="core.tenant",
                    ),
                ),
            ],
            options={
                "ordering": ["-submitted_at"],
                "indexes": [
                    models.Index(fields=["tenant", "-submitted_at"], name="form_submit_tenant_time_idx"),
                    models.Index(
                        fields=["page", "widget_id", "-submitted_at"],
                        name="form_submit_page_widget_idx",
                    ),
                ],
            },
        ),
    ]
