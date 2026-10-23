from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="AccountSecurity",
            fields=[
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True,
                                             serialize=False, to=settings.AUTH_USER_MODEL)),
                ("version", models.PositiveBigIntegerField(default=0)),
                ("changed_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
    ]
