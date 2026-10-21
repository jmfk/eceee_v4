from django.db import migrations, models
import webpages.theme_widgets


class Migration(migrations.Migration):
    dependencies = [("webpages", "0086_repair_legacy_preview_collections")]
    operations = [
        migrations.AddField(
            model_name="pagetheme",
            name="widget_types",
            field=models.JSONField(blank=True, default=webpages.theme_widgets.empty_widget_types),
        )
    ]
