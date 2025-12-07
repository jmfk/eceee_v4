# Generated migration to ensure all image styles have required fields
# Fixes validation errors for themes with incomplete image_styles data

from django.db import migrations
import logging

logger = logging.getLogger(__name__)


def ensure_image_styles_have_styletype(apps, schema_editor):
    """
    Ensure all image_styles have required fields (template and styleType).
    This fixes legacy data that may be missing these fields.
    """
    PageTheme = apps.get_model('webpages', 'PageTheme')
    
    fixes_made = []
    
    for theme in PageTheme.objects.all():
        if not theme.image_styles:
            continue
            
        image_styles = theme.image_styles.copy()
        modified = False
        
        for style_key, style_config in image_styles.items():
            if not isinstance(style_config, dict):
                logger.warning(
                    f"Theme '{theme.name}' (ID: {theme.id}): "
                    f"Image style '{style_key}' is not a dict, skipping"
                )
                continue
            
            # Ensure styleType exists
            if 'styleType' not in style_config:
                style_config['styleType'] = 'gallery'  # Safe default
                modified = True
                fixes_made.append(
                    f"Theme '{theme.name}' (ID: {theme.id}): "
                    f"Added styleType='gallery' to style '{style_key}'"
                )
            
            # Ensure template exists
            if 'template' not in style_config:
                style_config['template'] = (
                    '<div class="image-gallery">\n'
                    '  {{#images}}\n'
                    '    <img src="{{url}}" alt="{{alt}}" loading="lazy">\n'
                    '  {{/images}}\n'
                    '</div>'
                )
                modified = True
                fixes_made.append(
                    f"Theme '{theme.name}' (ID: {theme.id}): "
                    f"Added default template to style '{style_key}'"
                )
        
        # Save if modifications were made
        if modified:
            theme.image_styles = image_styles
            theme.save(update_fields=['image_styles'])
    
    # Log summary
    if fixes_made:
        logger.info(f"Fixed {len(fixes_made)} image style issues:")
        for fix in fixes_made:
            logger.info(f"  - {fix}")
    else:
        logger.info("No image style fixes needed")


def reverse_ensure_styletype(apps, schema_editor):
    """
    Reverse migration - no action needed as we only added missing fields.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('webpages', '0053_add_breakpoints_to_theme'),
    ]

    operations = [
        migrations.RunPython(
            ensure_image_styles_have_styletype,
            reverse_ensure_styletype
        ),
    ]



