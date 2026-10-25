from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("kanban", "0004_board_background")]

    operations = [
        migrations.AddField(
            model_name="card",
            name="cover_attachment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="kanban.attachment",
            ),
        ),
    ]
