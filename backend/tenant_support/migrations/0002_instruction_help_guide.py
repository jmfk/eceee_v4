from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tenant_support", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="instruction",
            name="help_guide_id",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddIndex(
            model_name="instruction",
            index=models.Index(fields=["tenant", "help_guide_id"], name="support_instruction_guide_idx"),
        ),
    ]
