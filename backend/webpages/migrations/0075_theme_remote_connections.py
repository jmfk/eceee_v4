import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("webpages", "0074_unique_theme_lineage"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ThemeRemoteAccessKey",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("key_hash", models.CharField(editable=False, max_length=64, unique=True)),
                ("key_prefix", models.CharField(editable=False, max_length=12)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_theme_remote_access_keys",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="theme_remote_access_keys",
                        to="core.tenant",
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="ThemeRemoteConnection",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("base_url", models.URLField(max_length=500)),
                ("remote_workspace", models.CharField(max_length=100)),
                ("encrypted_access_key", models.TextField(editable=False)),
                ("is_default", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_theme_remote_connections",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="updated_theme_remote_connections",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="theme_remote_connections",
                        to="core.tenant",
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddConstraint(
            model_name="themeremoteaccesskey",
            constraint=models.UniqueConstraint(fields=("tenant", "name"), name="unique_theme_remote_key_name"),
        ),
        migrations.AddConstraint(
            model_name="themeremoteconnection",
            constraint=models.UniqueConstraint(fields=("tenant", "name"), name="unique_theme_remote_connection_name"),
        ),
        migrations.AddConstraint(
            model_name="themeremoteconnection",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_default", True)), fields=("tenant",), name="one_default_theme_remote_connection"
            ),
        ),
    ]
