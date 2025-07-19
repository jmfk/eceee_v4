"""
Layout Autodiscovery System

This module provides automatic discovery and registration of layout classes
from Django apps, enabling third-party apps to simply define layouts
and have them automatically registered.
"""

import importlib
import logging
from typing import List
from django.apps import apps
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .layout_registry import layout_registry, BaseLayout

logger = logging.getLogger(__name__)


def autodiscover_layouts() -> None:
    """
    Automatically discover and register layout classes from all Django apps.

    This function looks for 'layouts' modules in each Django app and imports them,
    allowing layouts to be registered via the @register_layout decorator or
    manual registration calls.
    """
    logger.info("Starting layout autodiscovery...")

    discovered_count = 0

    for app_config in apps.get_app_configs():
        app_name = app_config.name

        try:
            # Try to import the layouts module from this app
            layouts_module_name = f"{app_name}.layouts"
            layouts_module = importlib.import_module(layouts_module_name)

            logger.debug(f"Imported layouts module from {app_name}")
            discovered_count += 1

        except ImportError:
            # No layouts module in this app, which is fine
            logger.debug(f"No layouts module found in {app_name}")
            continue
        except Exception as e:
            # Other errors during import should be logged as warnings
            logger.warning(f"Error importing layouts from {app_name}: {e}")
            continue

    total_layouts = len(layout_registry.list_layouts(active_only=False))
    logger.info(
        f"Layout autodiscovery complete. Found {discovered_count} layout modules, "
        f"{total_layouts} total layouts registered."
    )


def discover_layouts_in_app(app_name: str) -> List[str]:
    """
    Discover layouts in a specific app.

    Args:
        app_name: Name of the Django app to search

    Returns:
        List of layout names found in the app
    """
    initial_layouts = set(layout_registry._layouts.keys())

    try:
        layouts_module_name = f"{app_name}.layouts"
        importlib.import_module(layouts_module_name)
        logger.debug(f"Discovered layouts in {app_name}")
    except ImportError:
        logger.debug(f"No layouts module in {app_name}")
        return []
    except Exception as e:
        logger.warning(f"Error discovering layouts in {app_name}: {e}")
        return []

    # Return the new layouts that were registered
    current_layouts = set(layout_registry._layouts.keys())
    new_layouts = current_layouts - initial_layouts
    return list(new_layouts)


def validate_layout_configuration() -> None:
    """
    Validate all registered layouts have proper configuration.

    This is useful for checking layouts during app startup or in management commands.
    """
    logger.info("Validating layout configurations...")

    invalid_layouts = []

    for layout_name, layout_instance in layout_registry._instances.items():
        try:
            layout_instance.validate_slot_configuration()
            logger.debug(f"Layout '{layout_name}' configuration is valid")
        except Exception as e:
            logger.error(f"Layout '{layout_name}' has invalid configuration: {e}")
            invalid_layouts.append(layout_name)

    if invalid_layouts:
        raise ImproperlyConfigured(
            f"Invalid layout configurations found: {', '.join(invalid_layouts)}"
        )

    logger.info(
        f"All {len(layout_registry._instances)} layouts have valid configurations"
    )


def get_layout_summary() -> dict:
    """
    Get a summary of all registered layouts.

    Returns:
        Dictionary containing layout registration summary
    """
    layouts = layout_registry.list_layouts(active_only=False)
    active_layouts = layout_registry.list_layouts(active_only=True)

    summary = {
        "total_layouts": len(layouts),
        "active_layouts": len(active_layouts),
        "inactive_layouts": len(layouts) - len(active_layouts),
        "layout_names": [layout.name for layout in layouts],
        "active_layout_names": [layout.name for layout in active_layouts],
    }

    return summary


def reload_layouts() -> None:
    """
    Reload all layouts from scratch.

    This clears the registry and rediscovers all layouts. Useful for development
    or when layouts might have changed.
    """
    logger.info("Reloading all layouts...")

    # Clear existing registrations
    layout_registry.clear()

    # Rediscover all layouts
    autodiscover_layouts()

    # Validate configurations
    validate_layout_configuration()

    logger.info("Layout reload complete")


# Settings for layout discovery behavior
LAYOUT_AUTODISCOVERY_ENABLED = getattr(settings, "LAYOUT_AUTODISCOVERY_ENABLED", True)
LAYOUT_VALIDATION_ON_STARTUP = getattr(settings, "LAYOUT_VALIDATION_ON_STARTUP", True)
