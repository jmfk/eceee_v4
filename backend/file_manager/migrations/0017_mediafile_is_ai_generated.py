from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("file_manager", "0016_mediacollection_soft_delete")]

    operations = [
        migrations.AddField(
            model_name="mediafile",
            name="is_ai_generated",
            field=models.BooleanField(default=False, editable=False),
        ),
        migrations.AddField(
            model_name="mediafileversion",
            name="is_ai_generated",
            field=models.BooleanField(default=False, editable=False),
        ),
    ]
