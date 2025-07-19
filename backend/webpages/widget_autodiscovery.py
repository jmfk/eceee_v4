"""
Widget Type Autodiscovery System

This module provides automatic discovery of widget type classes from Django apps.
It follows the same pattern as the layout autodiscovery system.
"""

import logging
from django.apps import apps
from django.core.management.color import make_style
from importlib import import_module

from .widget_registry import widget_type_registry

logger = logging.getLogger(__name__)
style = make_style()


def autodiscover_widgets():
    """
    Automatically discover and register widget types from all Django apps.

    Looks for a 'widgets' module in each app and imports it to trigger
    widget type registration.
    """

    logger.info("Starting widget type autodiscovery...")

    for app_config in apps.get_app_configs():
        app_name = app_config.name

        try:
            # Try to import the widgets module from the app
            import_module(f"{app_name}.widgets")
            logger.info(f"Loaded widgets from {app_name}")

        except ImportError as e:
            # Check if it's a "No module named" error for the widgets module
            if f"No module named '{app_name}.widgets'" in str(e):
                # This is expected for apps without widgets, skip silently
                logger.debug(f"No widgets module found in {app_name}")
                continue
            else:
                # This is an actual import error in the widgets module
                logger.error(f"Error importing widgets from {app_name}: {e}")
                continue

        except Exception as e:
            logger.error(f"Unexpected error loading widgets from {app_name}: {e}")
            continue

    # Log summary
    widget_count = len(widget_type_registry.list_widget_types())
    logger.info(
        f"Widget type autodiscovery completed. Registered {widget_count} widget types."
    )


def validate_widget_types():
    """
    Validate all registered widget types for common issues.

    Returns a dictionary with validation results and any issues found.
    """

    results = {"valid": True, "total_widgets": 0, "issues": []}

    try:
        widget_types = widget_type_registry.list_widget_types(active_only=False)
        results["total_widgets"] = len(widget_types)

        for widget_type in widget_types:
            # Validate widget type configuration
            widget_issues = validate_single_widget_type(widget_type)
            if widget_issues:
                results["valid"] = False
                results["issues"].extend(widget_issues)

    except Exception as e:
        results["valid"] = False
        results["issues"].append(f"Error during validation: {str(e)}")

    return results


def validate_single_widget_type(widget_type):
    """
    Validate a single widget type for common issues.

    Args:
        widget_type: Widget type instance to validate

    Returns:
        List of issues found (empty if no issues)
    """

    issues = []
    widget_name = widget_type.name

    try:
        # 1. Check required attributes
        if not widget_type.name:
            issues.append(f"Widget '{widget_name}' missing required 'name' attribute")

        if not widget_type.template_name:
            issues.append(
                f"Widget '{widget_name}' missing required 'template_name' attribute"
            )

        # 2. Check configuration model
        try:
            config_model = widget_type.configuration_model
            if not config_model:
                issues.append(
                    f"Widget '{widget_name}' missing configuration_model property"
                )
            else:
                # Try to create an instance with empty data to test defaults
                try:
                    config_model()
                except Exception as e:
                    issues.append(
                        f"Widget '{widget_name}' configuration model validation failed: {str(e)}"
                    )

        except Exception as e:
            issues.append(
                f"Widget '{widget_name}' configuration_model property error: {str(e)}"
            )

        # 3. Test validation methods
        try:
            # Test with empty configuration
            is_valid, errors = widget_type.validate_configuration({})
            if not is_valid and not errors:
                issues.append(
                    f"Widget '{widget_name}' validate_configuration returned invalid but no errors"
                )

        except Exception as e:
            issues.append(
                f"Widget '{widget_name}' validate_configuration method error: {str(e)}"
            )

        # 4. Test defaults method
        try:
            defaults = widget_type.get_configuration_defaults()
            if not isinstance(defaults, dict):
                issues.append(
                    f"Widget '{widget_name}' get_configuration_defaults must return dict"
                )

        except Exception as e:
            issues.append(
                f"Widget '{widget_name}' get_configuration_defaults method error: {str(e)}"
            )

    except Exception as e:
        issues.append(f"Widget '{widget_name}' general validation error: {str(e)}")

    return issues


def get_widget_type_summary():
    """
    Get a summary of all registered widget types.

    Returns:
        Dictionary with widget type information
    """

    widget_types = widget_type_registry.list_widget_types(active_only=False)

    summary = {
        "total_count": len(widget_types),
        "active_count": len([w for w in widget_types if w.is_active]),
        "widget_types": [],
    }

    for widget_type in widget_types:
        try:
            config_schema = widget_type.configuration_model.model_json_schema()
            required_fields = config_schema.get("required", [])

            widget_info = {
                "name": widget_type.name,
                "description": widget_type.description,
                "template_name": widget_type.template_name,
                "is_active": widget_type.is_active,
                "required_fields": required_fields,
                "total_fields": len(config_schema.get("properties", {})),
            }

        except Exception as e:
            widget_info = {
                "name": widget_type.name,
                "description": widget_type.description,
                "template_name": widget_type.template_name,
                "is_active": widget_type.is_active,
                "error": f"Could not analyze configuration: {str(e)}",
            }

        summary["widget_types"].append(widget_info)

    return summary


def print_widget_type_summary():
    """Print a formatted summary of widget types to console."""

    summary = get_widget_type_summary()

    print(style.SUCCESS(f"\n=== Widget Types Summary ==="))
    print(f"Total widget types: {summary['total_count']}")
    print(f"Active widget types: {summary['active_count']}")

    if summary["widget_types"]:
        print(style.SUCCESS(f"\nRegistered Widget Types:"))

        for widget_info in summary["widget_types"]:
            status = (
                style.SUCCESS("✓") if widget_info["is_active"] else style.WARNING("✗")
            )
            print(f"  {status} {widget_info['name']}")
            print(f"    Description: {widget_info['description']}")
            print(f"    Template: {widget_info['template_name']}")

            if "error" in widget_info:
                print(style.ERROR(f"    Error: {widget_info['error']}"))
            else:
                print(
                    f"    Fields: {widget_info.get('total_fields', 0)} total, {len(widget_info.get('required_fields', []))} required"
                )

            print()  # Empty line between widgets
    else:
        print(style.WARNING("No widget types registered."))

    print("=" * 30)
