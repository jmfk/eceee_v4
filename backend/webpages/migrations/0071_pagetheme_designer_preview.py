from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("webpages", "0070_theme_designer_models")]

    operations = [
        migrations.AddField(
            model_name="pagetheme",
            name="designer_preview",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Designer preview views and demo content. Views may represent pages or objects and "
                    "reference a registered layout while keeping their demo text and images separate from live content."
                ),
            ),
        ),
    ]
