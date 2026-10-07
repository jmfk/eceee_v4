import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("object_storage", "0024_objecttypedefinition_browser_group"),
        ("webpages", "0080_themeremoteconnection_credential_scheme"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="objectinstance",
            name="unique_slug_per_object_type",
        ),
        migrations.AddConstraint(
            model_name="objectinstance",
            constraint=models.UniqueConstraint(
                fields=("tenant", "slug", "object_type"),
                name="unique_slug_per_object_type_tenant",
            ),
        ),
        migrations.CreateModel(
            name="ObjectTransferJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(choices=[("export", "Export"), ("import", "Import")], max_length=20)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("object_key", models.CharField(blank=True, max_length=500)),
                ("options", models.JSONField(blank=True, default=dict)),
                ("progress", models.JSONField(blank=True, default=dict)),
                ("errors", models.JSONField(blank=True, default=list)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "connection",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="object_transfer_jobs",
                        to="webpages.themeremoteconnection",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="object_transfer_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="object_transfer_jobs",
                        to="core.tenant",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="objecttransferjob",
            index=models.Index(fields=["tenant", "kind", "status"], name="objtransfer_tenant_idx"),
        ),
        migrations.AddIndex(
            model_name="objecttransferjob", index=models.Index(fields=["expires_at"], name="objtransfer_expiry_idx")
        ),
    ]
