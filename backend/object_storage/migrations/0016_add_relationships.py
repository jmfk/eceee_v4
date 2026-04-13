# Generated manually for adding many-to-many relationships

from django.db import migrations, models
from django.contrib.postgres.indexes import GinIndex


class Migration(migrations.Migration):

    dependencies = [
        ("object_storage", "0015_objectversion_is_featured"),
    ]

    operations = [
        migrations.AddField(
            model_name="objectinstance",
            name="relationships",
            field=models.JSONField(
                default=list,
                blank=True,
                help_text="Many-to-many relationships to other objects with relationship types",
            ),
        ),
        migrations.AddField(
            model_name="objectinstance",
            name="related_from",
            field=models.JSONField(
                default=list,
                blank=True,
                help_text="Reverse relationships (auto-maintained mirror of relationships field)",
            ),
        ),
        migrations.AddIndex(
            model_name="objectinstance",
            index=GinIndex(
                fields=["relationships"], name="obj_inst_relationships_gin_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="objectinstance",
            index=GinIndex(
                fields=["related_from"], name="obj_inst_related_from_gin_idx"
            ),
        ),
    ]
