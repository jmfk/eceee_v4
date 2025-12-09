# Generated manually for annotation field support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('file_manager', '0009_mediafile_replaced_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='mediafile',
            name='metadata',
            field=models.JSONField(blank=True, default=dict, help_text='Additional metadata (e.g., annotation, custom fields)'),
        ),
        migrations.AddField(
            model_name='pendingmediafile',
            name='metadata',
            field=models.JSONField(blank=True, default=dict, help_text='Additional metadata (e.g., annotation, custom fields)'),
        ),
    ]

