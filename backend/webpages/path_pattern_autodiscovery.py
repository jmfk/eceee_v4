"""
Path Pattern Autodiscovery System

This module provides automatic discovery of path pattern classes from Django apps.
It follows the same pattern as the layout and widget autodiscovery systems.
"""

import logging
from django.apps import apps
from importlib import import_module

from .path_pattern_registry import path_pattern_registry

logger = logging.getLogger(__name__)


def autodiscover_path_patterns():
    """
    Automatically discover and register path patterns from all Django apps.

    Looks for a 'path_patterns' module in each app and imports it to trigger
    path pattern registration.
    """

    for app_config in apps.get_app_configs():
        app_name = app_config.name

        try:
            # Try to import the path_patterns module from the app
            import_module(f"{app_name}.path_patterns")

        except ImportError as e:
            # Check if it's a "No module named" error for the path_patterns module
            if f"No module named '{app_name}.path_patterns'" in str(e):
                # This is expected for apps without path_patterns, skip silently
                logger.debug(f"No path_patterns module found in {app_name}")
                continue
            else:
                # This is an actual import error in the path_patterns module
                logger.error(f"Error importing path_patterns from {app_name}: {e}")
                continue

        except Exception as e:
            logger.error(f"Unexpected error loading path patterns from {app_name}: {e}")
            continue

    # Log summary
    pattern_count = len(path_pattern_registry.list_patterns())


def validate_path_patterns():
    """
    Validate all registered path patterns for common issues.

    Returns a dictionary with validation results and any issues found.
    """
    issues = []
    patterns = path_pattern_registry.list_patterns()

    for pattern in patterns:
        # Check for required attributes
        if not pattern.key:
            issues.append(f"Pattern {pattern.__class__.__name__} missing 'key'")

        if not pattern.name:
            issues.append(f"Pattern {pattern.key} missing 'name'")

        if not pattern.regex_pattern:
            issues.append(f"Pattern {pattern.key} missing 'regex_pattern'")

        # Check for example URL
        if not pattern.example_url:
            issues.append(f"Pattern {pattern.key} missing 'example_url'")

        # Check that example URL matches the pattern
        if pattern.example_url:
            result = pattern.validate_match(pattern.example_url)
            if result is None:
                issues.append(
                    f"Pattern {pattern.key}: example_url '{pattern.example_url}' "
                    f"does not match its own regex pattern"
                )

        # Check extracted_variables metadata
        if not pattern.extracted_variables:
            issues.append(
                f"Pattern {pattern.key} missing 'extracted_variables' metadata"
            )
        else:
            for var in pattern.extracted_variables:
                required_keys = ["name", "type", "description", "example"]
                for key in required_keys:
                    if key not in var:
                        issues.append(
                            f"Pattern {pattern.key}: variable metadata missing '{key}'"
                        )

    return {
        "valid": len(issues) == 0,
        "pattern_count": len(patterns),
        "issues": issues,
    }
