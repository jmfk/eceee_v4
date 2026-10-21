from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("webpages", "0086_repair_legacy_preview_collections")]
    operations = [
        migrations.AddField(
            model_name="pagetheme",
            name="text_outline_styles",
            field=models.JSONField(default=dict, blank=True, help_text="Named theme-wide text effects"),
        )
    ]
