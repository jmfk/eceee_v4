from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("webpages", "0077_publicformsubmission"),
    ]

    operations = [
        migrations.AddField(
            model_name="pageversion",
            name="edit_revision",
            field=models.PositiveBigIntegerField(
                default=1,
                help_text="Monotonic concurrency token for mutations to this version",
            ),
        ),
        migrations.AddField(
            model_name="pageversion",
            name="last_edited_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="last_edited_page_versions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
