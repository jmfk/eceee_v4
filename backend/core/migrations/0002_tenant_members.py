from django.conf import settings
from django.db import migrations, models


def add_tenant_creators_as_members(apps, schema_editor):
    Tenant = apps.get_model("core", "Tenant")
    through = Tenant.members.through
    through.objects.bulk_create(
        [through(tenant_id=tenant.id, user_id=tenant.created_by_id) for tenant in Tenant.objects.all()],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="members",
            field=models.ManyToManyField(
                blank=True,
                help_text="Users allowed to administer content in this tenant",
                related_name="member_tenants",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(add_tenant_creators_as_members, migrations.RunPython.noop),
    ]
