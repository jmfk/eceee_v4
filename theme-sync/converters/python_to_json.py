"""
Python to JSON converter.

Converts Python theme classes to JSON format for server storage.
Handles class inheritance using Python's MRO (Method Resolution Order).
"""

import importlib.util
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Type
from .mustache_handler import load_mustache_templates


def find_theme_class(module) -> Optional[Type]:
    """
    Find the theme class in a module.

    Looks for classes that:
    - End with 'Theme'
    - Have 'name' attribute
    - Are not imported from elsewhere
    """
    for name, obj in vars(module).items():
        if (
            isinstance(obj, type)
            and name.endswith("Theme")
            and hasattr(obj, "name")
            and obj.__module__ == module.__name__
        ):
            return obj
    return None


def extract_module_data(module_class: Type) -> Dict[str, Any]:
    """
    Extract data from a module class (e.g., Colors, Fonts).

    Args:
        module_class: Class from a module (e.g., Colors, Fonts)

    Returns:
        Dictionary with class attributes
    """
    data = {}
    for key, value in vars(module_class).items():
        if not key.startswith("_") and not callable(value):
            data[key] = value
    return data


def extract_module_data(module_class: Type) -> Dict[str, Any]:
    """
    Extract data from a module class (e.g., Colors, Fonts).

    Args:
        module_class: Class from a module (e.g., Colors, Fonts)

    Returns:
        Dictionary with class attributes
    """
    data = {}
    for key, value in vars(module_class).items():
        if not key.startswith("_") and not callable(value):
            data[key] = value
    return data


def resolve_inheritance(theme_class: Type) -> Dict[str, Any]:
    """
    Resolve class inheritance using Python's MRO.

    Collects attributes from parent classes, with child classes overriding.
    Handles both module classes (Colors, Fonts, etc.) and direct values.

    Args:
        theme_class: Theme class to convert

    Returns:
        Dictionary with all theme attributes (inherited + overridden)
    """
    theme_data = {}

    # Walk MRO in reverse to get base classes first, then child classes
    # This way child attributes override parent attributes
    for cls in reversed(theme_class.__mro__):
        if cls is object:
            continue

        # Get all class attributes (not methods)
        for key, value in vars(cls).items():
            if not key.startswith("_") and not callable(value):
                # Check if value is a module class (e.g., Colors, Fonts)
                if isinstance(value, type) and hasattr(value, "__module__"):
                    # It's a class from another module - extract its attributes
                    module_data = extract_module_data(value)
                    if key not in theme_data:
                        theme_data[key] = {}
                    if isinstance(module_data, dict):
                        # For dict-like modules (colors, fonts), merge
                        if key in ["colors", "fonts"]:
                            theme_data[key].update(module_data)
                        else:
                            # For other modules, store as dict
                            theme_data[key] = module_data
                    else:
                        theme_data[key] = module_data
                # Handle dict merging for colors, fonts, etc. (legacy support)
                elif key in ["colors", "fonts"] and isinstance(value, dict):
                    if key not in theme_data:
                        theme_data[key] = {}
                    theme_data[key].update(value)
                elif key in [
                    "design_groups",
                    "component_styles",
                    "image_styles",
                    "table_templates",
                ]:
                    if key not in theme_data:
                        theme_data[key] = {}
                    if isinstance(value, dict):
                        theme_data[key].update(value)
                else:
                    theme_data[key] = value

    return theme_data


def convert_theme_to_json(theme_file_path: Path) -> Dict[str, Any]:
    """
    Convert a Python theme file to JSON-compatible dictionary.
    Supports both single-file and multi-module theme structures.

    Args:
        theme_file_path: Path to theme.py file

    Returns:
        Dictionary ready for JSON serialization
    """
    # Import the module dynamically
    spec = importlib.util.spec_from_file_location("theme_module", theme_file_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load module from {theme_file_path}")

    module = importlib.util.module_from_spec(spec)

    # Add themes root directory to path for imports
    # theme_file_path is like: themes/eceee.org/base/industry/theme.py
    # We need to add themes/ to the path
    theme_dir = theme_file_path.parent
    themes_root = theme_dir
    # Go up until we find 'themes' directory or reach reasonable depth
    for _ in range(5):  # Max 5 levels up
        if themes_root.name == "themes" or themes_root.parent == themes_root:
            break
        themes_root = themes_root.parent

    # If we found themes directory, add its parent to path
    if themes_root.name == "themes":
        themes_root = themes_root.parent

    themes_root_str = str(themes_root)
    if themes_root_str not in sys.path:
        sys.path.insert(0, themes_root_str)

    try:
        spec.loader.exec_module(module)
    except Exception as e:
        raise ValueError(f"Error executing module {theme_file_path}: {e}")

    # Find theme class
    theme_class = find_theme_class(module)
    if theme_class is None:
        raise ValueError(f"No theme class found in {theme_file_path}")

    # Resolve inheritance (handles both module classes and direct values)
    theme_data = resolve_inheritance(theme_class)

    # Load Mustache templates from disk
    theme_data = load_mustache_templates(theme_dir, theme_data)

    # Handle image file - if it's a filename, we'll need to upload it
    # For now, keep the filename (upload will be handled in sync_service)
    image = theme_data.get("image")
    if (
        image
        and isinstance(image, str)
        and not ("http://" in image or "https://" in image)
    ):
        # It's a filename, not a URL - keep it as is for now
        # The sync service will handle uploading the file
        pass

    # Upload design group images and update URLs in theme_data
    # This will be handled by the sync service which has access to backend API
    # For now, mark local files that need to be uploaded
    theme_data = mark_design_group_images_for_upload(theme_dir, theme_data)

    # Ensure required fields
    if "name" not in theme_data:
        raise ValueError(f"Theme class must have a 'name' attribute")

    # Convert to JSON-serializable format
    json_data = {}
    for key, value in theme_data.items():
        if isinstance(value, (dict, list, str, int, float, bool, type(None))):
            json_data[key] = value
        elif isinstance(value, type):
            # If it's still a class, extract its attributes
            json_data[key] = extract_module_data(value)
        else:
            # Convert other types to string representation
            json_data[key] = str(value)

    return json_data


def mark_design_group_images_for_upload(
    theme_dir: Path, theme_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Mark design group images for upload.
    Checks for local image files in design_group_images/ directory.
    Updates theme_data with placeholder that sync_service will replace with uploaded URLs.

    Args:
        theme_dir: Theme directory path
        theme_data: Theme data dictionary

    Returns:
        Updated theme_data with image upload markers
    """
    images_dir = theme_dir / "design_group_images"
    if not images_dir.exists():
        return theme_data

    # Get list of local image files
    local_images = {}
    for image_file in images_dir.iterdir():
        if image_file.is_file() and image_file.suffix.lower() in [
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".svg",
        ]:
            local_images[image_file.name] = image_file

    if not local_images:
        return theme_data

    # Mark images in design_groups for upload
    design_groups = theme_data.get("design_groups", {})
    if design_groups and "groups" in design_groups:
        for group in design_groups["groups"]:
            if "layoutProperties" in group:
                for part, breakpoints in group["layoutProperties"].items():
                    for bp, props in breakpoints.items():
                        if "images" in props and isinstance(props["images"], dict):
                            for image_key, image_data in props["images"].items():
                                if isinstance(image_data, dict):
                                    # Check if URL is a local filename
                                    url = image_data.get("url", "")
                                    filename = (
                                        url.split("/")[-1]
                                        if url
                                        else image_data.get("filename", "")
                                    )

                                    if filename in local_images:
                                        # Mark for upload by adding __local_file__ marker
                                        image_data["__local_file__"] = str(
                                            local_images[filename]
                                        )

    return theme_data
