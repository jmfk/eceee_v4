from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("data_connections", "0006_alter_dataconnection_options_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="dataconnection",
            name="connection_type",
            field=models.CharField(
                choices=[
                    ("INTERNAL", "Internal System"),
                    ("EXTERNAL_REST", "External REST API"),
                    ("EXTERNAL_DB", "External Database"),
                    ("LEGACY_POSTGRES", "Legacy PostgreSQL (unsupported)"),
                    ("LEGACY_API", "Legacy Migration API"),
                    ("FILEMAKER", "FileMaker Data API"),
                ],
                max_length=32,
            ),
        ),
    ]
