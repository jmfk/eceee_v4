import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("core", "0002_tenant_members"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="MachineAPIKey",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("environment", models.CharField(max_length=32)),
                ("scopes", models.JSONField(default=list)),
                ("key_hash", models.CharField(editable=False, max_length=64, unique=True)),
                ("key_prefix", models.CharField(editable=False, max_length=16)),
                ("is_active", models.BooleanField(default=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_machine_api_keys",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "principal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="machine_api_keys",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("tenants", models.ManyToManyField(related_name="machine_api_keys", to="core.tenant")),
            ],
            options={"ordering": ["name", "created_at"]},
        ),
        migrations.AddConstraint(
            model_name="machineapikey",
            constraint=models.UniqueConstraint(fields=("environment", "name"), name="unique_machine_key_name"),
        ),
    ]
