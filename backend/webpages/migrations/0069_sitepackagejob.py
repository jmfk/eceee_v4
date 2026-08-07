from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("webpages", "0068_alter_pagetheme_breakpoints_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SitePackageJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[("export", "Export"), ("import", "Import")],
                        max_length=20,
                    ),
                ),
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
                (
                    "object_key",
                    models.CharField(
                        blank=True,
                        help_text="Object-store key for generated export ZIP or staged import ZIP.",
                        max_length=500,
                    ),
                ),
                ("progress", models.JSONField(blank=True, default=dict)),
                ("errors", models.JSONField(blank=True, default=list)),
                ("options", models.JSONField(blank=True, default=dict)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="site_package_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "imported_root_page",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="site_package_import_jobs",
                        to="webpages.webpage",
                    ),
                ),
                (
                    "root_page",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="site_package_jobs",
                        to="webpages.webpage",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="sitepackagejob",
            index=models.Index(
                fields=["kind", "status"], name="sitepkg_kind_status_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="sitepackagejob",
            index=models.Index(
                fields=["created_by", "created_at"], name="sitepkg_user_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="sitepackagejob",
            index=models.Index(fields=["expires_at"], name="sitepkg_expires_idx"),
        ),
    ]
