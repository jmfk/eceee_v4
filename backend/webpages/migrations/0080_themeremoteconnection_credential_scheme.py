from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("webpages", "0079_remote_site_transfer")]

    operations = [
        migrations.AddField(
            model_name="themeremoteconnection",
            name="credential_scheme",
            field=models.CharField(
                choices=[("theme_key", "Theme key"), ("api_key", "Machine API key")],
                default="theme_key",
                max_length=20,
            ),
        )
    ]
