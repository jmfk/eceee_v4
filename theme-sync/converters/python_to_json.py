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
                if isinstance(value, type) and hasattr(value, '__module__'):
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
                elif key in ["design_groups", "component_styles", "image_styles", "table_templates"]:
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
        if themes_root.name == 'themes' or themes_root.parent == themes_root:
            break
        themes_root = themes_root.parent
    
    # If we found themes directory, add its parent to path
    if themes_root.name == 'themes':
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
    if image and isinstance(image, str) and not ("http://" in image or "https://" in image):
        # It's a filename, not a URL - keep it as is for now
        # The sync service will handle uploading the file
        pass
    
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

