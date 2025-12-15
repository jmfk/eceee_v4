# Generated migration for theme sync fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('webpages', '0058_migrate_navbar_footer_to_layout_properties'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagetheme',
            name='sync_version',
            field=models.IntegerField(
                default=1,
                help_text='Version counter for sync conflict detection. Increments on each change.',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='pagetheme',
            name='last_synced_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Last time this theme was synced via file sync service',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='pagetheme',
            name='sync_source',
            field=models.CharField(
                choices=[('web', 'Web'), ('sync', 'File Sync')],
                default='web',
                help_text='Source of the last change (web UI or file sync)',
                max_length=50,
            ),
        ),
        migrations.AddIndex(
            model_name='pagetheme',
            index=models.Index(fields=['sync_version'], name='pagetheme_sync_version_idx'),
        ),
    ]

