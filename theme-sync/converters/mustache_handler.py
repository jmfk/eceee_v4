"""
Mustache template file handler.

Handles loading and saving Mustache templates to/from disk.
"""

from pathlib import Path
from typing import Dict, Optional


def load_mustache_templates(theme_dir: Path, template_data: Dict) -> Dict:
    """
    Load Mustache templates from disk and embed in template data.
    
    Args:
        theme_dir: Directory containing theme files
        template_data: Dictionary with template references (e.g., component_styles)
    
    Returns:
        Updated template_data with templates loaded from files
    """
    # Handle component_styles
    if "component_styles" in template_data and isinstance(template_data["component_styles"], dict):
        component_dir = theme_dir / "component_styles"
        if component_dir.exists():
            for style_name, style_config in template_data["component_styles"].items():
                if isinstance(style_config, dict):
                    template_file = component_dir / f"{style_name}.mustache"
                    if template_file.exists():
                        style_config["template"] = template_file.read_text(encoding="utf-8")
    
    # Handle image_styles
    if "image_styles" in template_data and isinstance(template_data["image_styles"], dict):
        image_dir = theme_dir / "image_styles"
        if image_dir.exists():
            for style_name, style_config in template_data["image_styles"].items():
                if isinstance(style_config, dict):
                    template_file = image_dir / f"{style_name}.mustache"
                    if template_file.exists():
                        style_config["template"] = template_file.read_text(encoding="utf-8")
    
    return template_data


def save_mustache_templates(theme_dir: Path, template_data: Dict) -> None:
    """
    Extract Mustache templates from template_data and save to disk.
    
    Args:
        theme_dir: Directory to save theme files
        template_data: Dictionary with embedded templates
    """
    # Handle component_styles
    if "component_styles" in template_data and isinstance(template_data["component_styles"], dict):
        component_dir = theme_dir / "component_styles"
        component_dir.mkdir(parents=True, exist_ok=True)
        
        for style_name, style_config in template_data["component_styles"].items():
            if isinstance(style_config, dict) and "template" in style_config:
                template_file = component_dir / f"{style_name}.mustache"
                template_file.write_text(style_config["template"], encoding="utf-8")
                # Remove template from dict (will be loaded from file)
                del style_config["template"]
    
    # Handle image_styles
    if "image_styles" in template_data and isinstance(template_data["image_styles"], dict):
        image_dir = theme_dir / "image_styles"
        image_dir.mkdir(parents=True, exist_ok=True)
        
        for style_name, style_config in template_data["image_styles"].items():
            if isinstance(style_config, dict) and "template" in style_config:
                template_file = image_dir / f"{style_name}.mustache"
                template_file.write_text(style_config["template"], encoding="utf-8")
                # Remove template from dict (will be loaded from file)
                del style_config["template"]

