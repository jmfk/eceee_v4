from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0021_reset_namespace_id_sequence"),
    ]

    operations = [
        migrations.AddField(
            model_name="namespace",
            name="kind",
            field=models.CharField(
                choices=[("content", "Content"), ("theme_media", "Theme media")],
                db_index=True,
                default="content",
                help_text="System purpose of this namespace",
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="namespace",
            constraint=models.UniqueConstraint(
                condition=models.Q(kind="theme_media"),
                fields=("tenant",),
                name="one_theme_media_namespace_per_tenant",
            ),
        ),
    ]
