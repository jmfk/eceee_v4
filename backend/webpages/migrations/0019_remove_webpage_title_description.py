# Generated migration for removing title and description fields from WebPage

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0018_migrate_title_description_to_page_data"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="webpage",
            name="title",
        ),
        migrations.RemoveField(
            model_name="webpage",
            name="description",
        ),
    ]
