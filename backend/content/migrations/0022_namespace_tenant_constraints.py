from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0021_reset_namespace_id_sequence"),
    ]

    operations = [
        migrations.AlterField(
            model_name="namespace",
            name="name",
            field=models.CharField(help_text="Human-readable namespace name", max_length=100),
        ),
        migrations.AlterField(
            model_name="namespace",
            name="slug",
            field=models.SlugField(help_text="URL-safe namespace identifier", max_length=100),
        ),
        migrations.AddConstraint(
            model_name="namespace",
            constraint=models.UniqueConstraint(
                fields=("tenant", "name"),
                name="unique_namespace_name_per_tenant",
            ),
        ),
        migrations.AddConstraint(
            model_name="namespace",
            constraint=models.UniqueConstraint(
                fields=("tenant", "slug"),
                name="unique_namespace_slug_per_tenant",
            ),
        ),
        migrations.AddConstraint(
            model_name="namespace",
            constraint=models.UniqueConstraint(
                condition=Q(is_default=True),
                fields=("tenant",),
                name="unique_default_namespace_per_tenant",
            ),
        ),
    ]
