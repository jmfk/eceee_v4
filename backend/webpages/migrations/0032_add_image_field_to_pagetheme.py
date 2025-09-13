# Generated manually for theme image upload functionality

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0031_add_is_default_to_theme_remove_layout_associations"),
    ]

    operations = [
        migrations.AddField(
            model_name="pagetheme",
            name="image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="theme_images/",
                help_text="Theme preview image for listings and selection",
            ),
        ),
    ]
