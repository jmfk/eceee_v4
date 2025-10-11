# Generated migration to add updated_at field to model state
# The column already exists in the database, so we only update the model state

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "object_storage",
            "0013_remove_objectversion_object_stor_effecti_idx_and_more",
        ),
    ]

    operations = [
        # Use SeparateDatabaseAndState to only update model state without DB operations
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="objectversion",
                    name="updated_at",
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
            database_operations=[
                # No database operations - column already exists
            ],
        ),
    ]
