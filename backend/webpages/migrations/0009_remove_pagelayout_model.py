# Generated manually to remove PageLayout model and layout field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0008_add_code_layout_field"),
    ]

    operations = [
        # Remove layout field from WebPage
        migrations.RemoveField(
            model_name="webpage",
            name="layout",
        ),
        # Delete PageLayout model
        migrations.DeleteModel(
            name="PageLayout",
        ),
    ]
