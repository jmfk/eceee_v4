from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("webpages", "0075_theme_remote_connections"),
    ]

    operations = [
        migrations.AddField(
            model_name="themeversion",
            name="name",
            field=models.CharField(blank=True, max_length=160),
        ),
    ]
