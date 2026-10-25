from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("kanban", "0003_card_presentation")]

    operations = [
        migrations.AddField(
            model_name="board",
            name="background_path",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="board",
            name="background_content_type",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
