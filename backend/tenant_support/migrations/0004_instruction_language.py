from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tenant_support", "0003_supportthread_board_card_supportthread_participants_and_more")]

    operations = [
        migrations.AddField(
            model_name="instruction",
            name="language",
            field=models.CharField(
                choices=[("sv", "Svenska"), ("en", "English")], default="sv", max_length=2, null=True
            ),
        ),
    ]
