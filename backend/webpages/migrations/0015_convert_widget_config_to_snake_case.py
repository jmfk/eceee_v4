# Generated manually on 2025-09-12

from django.db import migrations
import json
import re
import logging

logger = logging.getLogger(__name__)


def camel_to_snake_case(name):
    """Convert camelCase to snake_case"""
    # Insert underscore before uppercase letters (except first character)
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    # Insert underscore before uppercase letters preceded by lowercase
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def convert_camel_to_snake(obj):
    """Convert camelCase keys to snake_case recursively"""
    if isinstance(obj, dict):
        converted = {}
        for key, value in obj.items():
            # Convert camelCase key to snake_case
            snake_key = camel_to_snake_case(key)
            # Recursively convert nested objects
            converted[snake_key] = convert_camel_to_snake(value)
        return converted
    elif isinstance(obj, list):
        return [convert_camel_to_snake(item) for item in obj]
    else:
        return obj


def convert_widget_configs_to_snake_case(apps, schema_editor):
    """Convert all widget configuration fields from camelCase to snake_case"""
    PageVersion = apps.get_model("webpages", "PageVersion")

    updated_count = 0

    for version in PageVersion.objects.all():
        if not version.widgets or not isinstance(version.widgets, dict):
            continue

        widgets_updated = False
        new_widgets = {}

        for slot_name, widgets_list in version.widgets.items():
            if not isinstance(widgets_list, list):
                new_widgets[slot_name] = widgets_list
                continue

            new_widgets_list = []

            for widget in widgets_list:
                if not isinstance(widget, dict):
                    new_widgets_list.append(widget)
                    continue

                new_widget = widget.copy()

                # Convert widget configuration from camelCase to snake_case
                if "config" in widget and isinstance(widget["config"], dict):
                    old_config = widget["config"]
                    new_config = convert_camel_to_snake(old_config)

                    # Only update if there was a change
                    if new_config != old_config:
                        new_widget["config"] = new_config
                        widgets_updated = True
                        logger.info(
                            f"Converted widget config in PageVersion {version.id}, slot '{slot_name}'"
                        )

                new_widgets_list.append(new_widget)

            new_widgets[slot_name] = new_widgets_list

        if widgets_updated:
            version.widgets = new_widgets
            version.save(update_fields=["widgets"])
            updated_count += 1

    logger.info(
        f"Updated {updated_count} PageVersions with snake_case widget configurations"
    )


def reverse_convert_widget_configs(apps, schema_editor):
    """This migration is not reversible as we can't reliably convert back"""
    # We don't implement reverse conversion because:
    # 1. We can't reliably determine which fields should be camelCase
    # 2. The conversion is a data cleanup, not a schema change
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0014_fix_widgets_default_type"),
    ]

    operations = [
        migrations.RunPython(
            convert_widget_configs_to_snake_case,
            reverse_convert_widget_configs,
        ),
    ]
