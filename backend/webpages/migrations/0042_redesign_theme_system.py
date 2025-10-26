# Generated migration for theme system redesign

from django.db import migrations, models
import json


def migrate_theme_data_forward(apps, schema_editor):
    """Migrate existing theme data to new structure"""
    PageTheme = apps.get_model("webpages", "PageTheme")

    for theme in PageTheme.objects.all():
        # Migrate css_variables -> colors
        if theme.css_variables and not theme.colors:
            theme.colors = theme.css_variables.copy()

        # Migrate html_elements -> typography
        if theme.html_elements and not theme.typography:
            # Create default typography group from html_elements
            theme.typography = {
                "groups": [
                    {
                        "name": "Default Typography",
                        "widget_type": None,
                        "slot": None,
                        "elements": convert_html_elements_to_typography(
                            theme.html_elements
                        ),
                    }
                ]
            }

        # Migrate image_styles -> component_styles
        if theme.image_styles and not theme.component_styles:
            theme.component_styles = convert_image_styles_to_component_styles(
                theme.image_styles
            )

        # Initialize empty structures if needed
        if not theme.fonts:
            theme.fonts = {}
        if not theme.table_templates:
            theme.table_templates = {}

        theme.save()


def convert_html_elements_to_typography(html_elements):
    """Convert old html_elements format to new typography elements format"""
    elements = {}

    for element, styles in html_elements.items():
        if not styles:
            continue

        # Convert CSS property names to camelCase
        converted_styles = {}
        for prop, value in styles.items():
            # Convert kebab-case to camelCase
            camel_prop = kebab_to_camel(prop)
            converted_styles[camel_prop] = value

        elements[element] = converted_styles

    return elements


def kebab_to_camel(text):
    """Convert kebab-case to camelCase"""
    components = text.split("-")
    return components[0] + "".join(x.title() for x in components[1:])


def convert_image_styles_to_component_styles(image_styles):
    """Convert old image_styles format to new component_styles format"""
    component_styles = {}

    for style_name, style_config in image_styles.items():
        # Create a basic component style that wraps the content
        # The actual rendering will use the legacy_config for backwards compatibility
        component_styles[style_name] = {
            "name": style_name,
            "description": f"Migrated from image style: {style_name}",
            "template": "{{content}}",
            "css": "",
            "legacy_config": style_config,  # Preserve original config
        }

    return component_styles


def migrate_theme_data_backward(apps, schema_editor):
    """Reverse migration (no-op, data preserved in old fields)"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0041_add_site_icon"),
    ]

    operations = [
        # Add new fields
        migrations.AddField(
            model_name="pagetheme",
            name="fonts",
            field=models.JSONField(
                default=dict,
                help_text="Google Fonts configuration with family, variants, and display settings",
            ),
        ),
        migrations.AddField(
            model_name="pagetheme",
            name="colors",
            field=models.JSONField(
                default=dict,
                help_text="Named color palette (key-value pairs of color names and hex/rgb values)",
            ),
        ),
        migrations.AddField(
            model_name="pagetheme",
            name="typography",
            field=models.JSONField(
                default=dict,
                help_text="Grouped HTML element styles with optional widget_type/slot targeting",
            ),
        ),
        migrations.AddField(
            model_name="pagetheme",
            name="component_styles",
            field=models.JSONField(
                default=dict,
                help_text="Named component styles with HTML templates and optional CSS",
            ),
        ),
        migrations.AddField(
            model_name="pagetheme",
            name="table_templates",
            field=models.JSONField(
                default=dict,
                help_text="Predefined table templates for the Table widget",
            ),
        ),
        # Update help text on deprecated fields
        migrations.AlterField(
            model_name="pagetheme",
            name="css_variables",
            field=models.JSONField(
                default=dict, help_text="DEPRECATED: Use 'colors' field instead"
            ),
        ),
        migrations.AlterField(
            model_name="pagetheme",
            name="html_elements",
            field=models.JSONField(
                default=dict, help_text="DEPRECATED: Use 'typography' field instead"
            ),
        ),
        migrations.AlterField(
            model_name="pagetheme",
            name="image_styles",
            field=models.JSONField(
                default=dict,
                help_text="DEPRECATED: Use 'component_styles' field instead",
            ),
        ),
        # Migrate existing data
        migrations.RunPython(
            migrate_theme_data_forward,
            migrate_theme_data_backward,
        ),
    ]
