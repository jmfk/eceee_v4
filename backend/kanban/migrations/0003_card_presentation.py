from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("kanban", "0002_board_members_column_role_and_more")]
    operations = [
        migrations.AddField(
            model_name="card", name="cover_color", field=models.CharField(blank=True, default="", max_length=16)
        ),
        migrations.AddField(
            model_name="card",
            name="mirror_of",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="mirrors",
                to="kanban.card",
            ),
        ),
    ]
