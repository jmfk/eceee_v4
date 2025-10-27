"""
Data migration to populate themes with default gallery/carousel/component styles.

This migration extracts CSS from widget templates and adds them as default
styles to the theme system for better performance and customization.
"""

from django.db import migrations


def populate_default_styles(apps, schema_editor):
    """Add default styles to existing themes"""
    PageTheme = apps.get_model("webpages", "PageTheme")

    # Get default styles from the model's static methods
    from webpages.models import PageTheme as CurrentPageTheme

    default_gallery_styles = CurrentPageTheme.get_default_gallery_styles()
    default_carousel_styles = CurrentPageTheme.get_default_carousel_styles()
    default_component_styles = CurrentPageTheme.get_default_component_styles()

    # Update all themes
    for theme in PageTheme.objects.all():
        updated = False

        # Add gallery styles if empty
        if not theme.gallery_styles:
            theme.gallery_styles = default_gallery_styles
            updated = True

        # Add carousel styles if empty
        if not theme.carousel_styles:
            theme.carousel_styles = default_carousel_styles
            updated = True

        # Add component styles if empty
        if not theme.component_styles:
            theme.component_styles = default_component_styles
            updated = True

        if updated:
            theme.save()


def reverse_populate(apps, schema_editor):
    """Reverse migration - clear default styles"""
    # We don't actually remove the styles on reverse as they may have been customized
    pass


class Migration(migrations.Migration):
    dependencies = [
        (
            "webpages",
            "0043_add_image_style_templates",
        ),  # Update to your latest migration
    ]

    operations = [
        migrations.RunPython(populate_default_styles, reverse_populate),
    ]
