"""
JSON to Python converter.

Generates Python theme classes from JSON theme data.
Extracts Mustache templates to separate files.
Supports multi-module structure with separate files for colors, fonts, etc.
"""

from pathlib import Path
from typing import Dict, Any, Optional
from .mustache_handler import save_mustache_templates


def generate_colors_module(colors_data: Dict[str, Any]) -> str:
    """Generate colors.py module from colors data."""
    if not colors_data:
        return '"""Color palette definitions"""\n\nclass Colors:\n    pass\n'
    
    lines = ['"""Color palette definitions"""', '', 'class Colors:']
    
    for key, value in colors_data.items():
        if isinstance(value, str):
            lines.append(f'    {key} = "{value}"')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_fonts_module(fonts_data: Dict[str, Any]) -> str:
    """Generate fonts.py module from fonts data."""
    if not fonts_data:
        return '"""Font configuration"""\n\nclass Fonts:\n    pass\n'
    
    lines = ['"""Font configuration"""', '', 'class Fonts:']
    
    for key, value in fonts_data.items():
        if isinstance(value, dict):
            lines.append(f'    {key} = {_format_dict(value, indent=4)}')
        elif isinstance(value, list):
            lines.append(f'    {key} = {_format_list(value, indent=4)}')
        elif isinstance(value, str):
            lines.append(f'    {key} = "{value}"')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_design_groups_module(design_groups_data: Dict[str, Any]) -> str:
    """Generate design_groups.py module from design_groups data."""
    if not design_groups_data:
        return '"""Design group styles with layout properties"""\n\nclass DesignGroups:\n    pass\n'
    
    lines = ['"""Design group styles with layout properties"""', '', 'class DesignGroups:']
    
    for key, value in design_groups_data.items():
        if isinstance(value, dict):
            lines.append(f'    {key} = {_format_dict(value, indent=4)}')
        elif isinstance(value, list):
            lines.append(f'    {key} = {_format_list(value, indent=4)}')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_component_styles_module(component_styles_data: Dict[str, Any]) -> str:
    """Generate component_styles.py module from component_styles data."""
    if not component_styles_data:
        return '"""Component styles with Mustache templates"""\n\nclass ComponentStyles:\n    pass\n'
    
    lines = ['"""Component styles with Mustache templates"""', '', 'class ComponentStyles:']
    
    for key, value in component_styles_data.items():
        if isinstance(value, dict):
            # Remove template from dict (will be loaded from file)
            value_copy = value.copy()
            if 'template' in value_copy:
                value_copy['template'] = ''  # Empty string, loaded from file
            lines.append(f'    {key} = {_format_dict(value_copy, indent=4)}')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_image_styles_module(image_styles_data: Dict[str, Any]) -> str:
    """Generate image_styles.py module from image_styles data."""
    if not image_styles_data:
        return '"""Image styles (gallery/carousel)"""\n\nclass ImageStyles:\n    pass\n'
    
    lines = ['"""Image styles (gallery/carousel)"""', '', 'class ImageStyles:']
    
    for key, value in image_styles_data.items():
        if isinstance(value, dict):
            # Remove template from dict (will be loaded from file)
            value_copy = value.copy()
            if 'template' in value_copy:
                value_copy['template'] = ''  # Empty string, loaded from file
            lines.append(f'    {key} = {_format_dict(value_copy, indent=4)}')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_table_templates_module(table_templates_data: Dict[str, Any]) -> str:
    """Generate table_templates.py module from table_templates data."""
    if not table_templates_data:
        return '"""Table templates"""\n\nclass TableTemplates:\n    pass\n'
    
    lines = ['"""Table templates"""', '', 'class TableTemplates:']
    
    for key, value in table_templates_data.items():
        if isinstance(value, dict):
            lines.append(f'    {key} = {_format_dict(value, indent=4)}')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def generate_breakpoints_module(breakpoints_data: Dict[str, Any]) -> str:
    """Generate breakpoints.py module from breakpoints data."""
    if not breakpoints_data:
        return '"""Responsive breakpoint configuration"""\n\nclass Breakpoints:\n    sm = 640\n    md = 768\n    lg = 1024\n    xl = 1280\n'
    
    lines = ['"""Responsive breakpoint configuration"""', '', 'class Breakpoints:']
    
    for key, value in breakpoints_data.items():
        if isinstance(value, (int, float)):
            lines.append(f'    {key} = {value}')
        else:
            lines.append(f'    {key} = {repr(value)}')
    
    return '\n'.join(lines) + '\n'


def detect_parent_theme(theme_data: Dict[str, Any], all_themes: Dict[str, Dict]) -> Optional[str]:
    """
    Detect if this theme should inherit from another theme.
    
    Looks for common patterns:
    - Name contains parent theme name (e.g., "Modern Blue Dark" → "Modern Blue")
    - Similar structure with overrides
    
    Args:
        theme_data: Current theme data
        all_themes: All available themes (name -> data)
    
    Returns:
        Parent theme name if found, None otherwise
    """
    theme_name = theme_data.get("name", "")
    
    # Simple heuristic: if name contains another theme name, it might inherit
    for other_name, other_data in all_themes.items():
        if other_name != theme_name and other_name in theme_name:
            # Check if structures are similar (same keys, different values)
            if set(theme_data.keys()) == set(other_data.keys()):
                return other_name
    
    return None


def generate_theme_class_code(
    theme_data: Dict[str, Any],
    parent_class: Optional[str] = None,
    parent_import: Optional[str] = None,
    use_modules: bool = True,
) -> str:
    """
    Generate Python class code from theme data.
    
    Args:
        theme_data: Theme data dictionary
        parent_class: Parent class name (if inheritance)
        parent_import: Import path for parent class
        use_modules: If True, import from separate modules; if False, inline all data
    
    Returns:
        Python code as string
    """
    theme_name = theme_data.get("name", "Theme")
    # Convert theme name to class name (remove spaces, capitalize)
    class_name = "".join(word.capitalize() for word in theme_name.split()) + "Theme"
    
    lines = []
    
    # Add parent import if needed
    if parent_import:
        lines.append(f"from {parent_import} import {parent_class}")
        lines.append("")
    
    # Add module imports if using multi-module structure
    if use_modules:
        module_imports = []
        if theme_data.get("colors"):
            module_imports.append("from .colors import Colors")
        if theme_data.get("fonts"):
            module_imports.append("from .fonts import Fonts")
        if theme_data.get("design_groups"):
            module_imports.append("from .design_groups import DesignGroups")
        if theme_data.get("component_styles"):
            module_imports.append("from .component_styles import ComponentStyles")
        if theme_data.get("image_styles"):
            module_imports.append("from .image_styles import ImageStyles")
        if theme_data.get("table_templates"):
            module_imports.append("from .table_templates import TableTemplates")
        if theme_data.get("breakpoints"):
            module_imports.append("from .breakpoints import Breakpoints")
        
        if module_imports:
            lines.extend(module_imports)
            lines.append("")
    
    # Class definition
    if parent_class:
        lines.append(f"class {class_name}({parent_class}):")
    else:
        lines.append(f"class {class_name}:")
    
    # Docstring
    description = theme_data.get("description", "")
    if description:
        lines.append(f'    """{description}"""')
        lines.append("")
    
    # Add name and description
    theme_name_value = theme_data.get("name", "")
    # Escape quotes and newlines in the name
    theme_name_escaped = theme_name_value.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', '\\n')
    lines.append(f'    name = "{theme_name_escaped}"')
    if description:
        # Escape quotes and newlines in description
        description_escaped = description.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', '\\n')
        lines.append(f'    description = "{description_escaped}"')
    else:
        lines.append('    description = ""')
    
    # Handle image - reference to file
    image = theme_data.get("image")
    if image:
        # Extract filename from URL if it's a URL
        if isinstance(image, str) and ("http://" in image or "https://" in image):
            # Extract filename from URL
            image_filename = image.split("/")[-1].split("?")[0]  # Remove query params
            if not image_filename or "." not in image_filename:
                image_filename = "theme_image.png"  # Default
        else:
            image_filename = str(image)
        lines.append(f'    image = "{image_filename}"')
    else:
        lines.append('    image = None')
    lines.append("")
    
    # Add module references or inline data
    if use_modules:
        if theme_data.get("colors"):
            lines.append("    colors = Colors")
        if theme_data.get("fonts"):
            lines.append("    fonts = Fonts")
        if theme_data.get("design_groups"):
            lines.append("    design_groups = DesignGroups")
        if theme_data.get("component_styles"):
            lines.append("    component_styles = ComponentStyles")
        if theme_data.get("image_styles"):
            lines.append("    image_styles = ImageStyles")
        if theme_data.get("table_templates"):
            lines.append("    table_templates = TableTemplates")
        if theme_data.get("breakpoints"):
            lines.append("    breakpoints = Breakpoints")
    else:
        # Legacy: inline all data
        field_order = [
            "fonts",
            "colors",
            "design_groups",
            "component_styles",
            "image_styles",
            "table_templates",
            "breakpoints",
        ]
        
        for field in field_order:
            if field in theme_data:
                value = theme_data[field]
                if isinstance(value, dict):
                    lines.append(f"    {field} = {_format_dict(value, indent=4)}")
                elif isinstance(value, str):
                    lines.append(f'    {field} = "{value}"')
                elif isinstance(value, (int, float, bool)):
                    lines.append(f"    {field} = {value}")
                elif value is None:
                    lines.append(f"    {field} = None")
                else:
                    lines.append(f"    {field} = {repr(value)}")
                lines.append("")
    
    return "\n".join(lines)


def _format_dict(d: Dict, indent: int = 0) -> str:
    """Format dictionary as Python code with proper indentation."""
    if not d:
        return "{}"
    
    indent_str = " " * indent
    lines = ["{"]
    
    for key, value in d.items():
        key_str = f'"{key}"' if isinstance(key, str) else str(key)
        
        if isinstance(value, dict):
            value_str = _format_dict(value, indent + 4)
        elif isinstance(value, str):
            # Escape quotes and newlines
            escaped = value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            value_str = f'"{escaped}"'
        elif isinstance(value, list):
            value_str = _format_list(value, indent + 4)
        else:
            value_str = repr(value)
        
        lines.append(f'{indent_str}    {key_str}: {value_str},')
    
    lines.append(f"{indent_str}}}")
    return "\n".join(lines)


def _format_list(l: list, indent: int = 0) -> str:
    """Format list as Python code with proper indentation."""
    if not l:
        return "[]"
    
    indent_str = " " * indent
    lines = ["["]
    
    for item in l:
        if isinstance(item, dict):
            item_str = _format_dict(item, indent + 4)
        elif isinstance(item, str):
            escaped = item.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            item_str = f'"{escaped}"'
        elif isinstance(item, list):
            item_str = _format_list(item, indent + 4)
        else:
            item_str = repr(item)
        
        lines.append(f'{indent_str}    {item_str},')
    
    lines.append(f"{indent_str}]")
    return "\n".join(lines)


def generate_theme_from_json(
    theme_data: Dict[str, Any],
    theme_dir: Path,
    all_themes: Optional[Dict[str, Dict]] = None,
    use_modules: bool = True,
) -> None:
    """
    Generate Python theme files from JSON data.
    
    Args:
        theme_data: Theme data from server
        theme_dir: Directory to save theme files
        all_themes: All themes (for detecting inheritance)
        use_modules: If True, generate multi-module structure; if False, single file
    """
    theme_dir.mkdir(parents=True, exist_ok=True)
    
    # Detect parent theme and determine import path
    parent_class = None
    parent_import = None
    if all_themes:
        parent_name = detect_parent_theme(theme_data, all_themes)
        if parent_name:
            # Extract tenant_id and category from theme_dir path
            # theme_dir is like: themes/eceee.org/base/industry
            parts = theme_dir.parts
            if len(parts) >= 3:
                # Find themes/ in path
                try:
                    themes_idx = parts.index('themes')
                    if themes_idx + 2 < len(parts):
                        tenant_id = parts[themes_idx + 1]  # tenant identifier
                        category = parts[themes_idx + 2]  # base or custom
                        parent_theme_dir = theme_dir.parent.parent / category / parent_name.lower().replace(' ', '_')
                        # Convert tenant_id to safe Python import identifier
                        tenant_import = tenant_id.replace('.', '_').replace('-', '_')
                        parent_import = f"themes.{tenant_import}.{category}.{parent_name.lower().replace(' ', '_')}.theme"
                        parent_class = "".join(word.capitalize() for word in parent_name.split()) + "Theme"
                except (ValueError, IndexError):
                    # Fallback to old structure
                    if "dark" in theme_data.get("name", "").lower():
                        parent_import = f"themes.base.{parent_name.lower().replace(' ', '_')}.theme"
                    else:
                        parent_import = f"themes.base.{parent_name.lower().replace(' ', '_')}.theme"
                    parent_class = "".join(word.capitalize() for word in parent_name.split()) + "Theme"
    
    if use_modules:
        # Generate module files
        if theme_data.get("colors"):
            colors_code = generate_colors_module(theme_data["colors"])
            (theme_dir / "colors.py").write_text(colors_code, encoding="utf-8")
        
        if theme_data.get("fonts"):
            fonts_code = generate_fonts_module(theme_data["fonts"])
            (theme_dir / "fonts.py").write_text(fonts_code, encoding="utf-8")
        
        if theme_data.get("design_groups"):
            design_groups_code = generate_design_groups_module(theme_data["design_groups"])
            (theme_dir / "design_groups.py").write_text(design_groups_code, encoding="utf-8")
        
        if theme_data.get("component_styles"):
            component_styles_code = generate_component_styles_module(theme_data["component_styles"])
            (theme_dir / "component_styles.py").write_text(component_styles_code, encoding="utf-8")
        
        if theme_data.get("image_styles"):
            image_styles_code = generate_image_styles_module(theme_data["image_styles"])
            (theme_dir / "image_styles.py").write_text(image_styles_code, encoding="utf-8")
        
        if theme_data.get("table_templates"):
            table_templates_code = generate_table_templates_module(theme_data["table_templates"])
            (theme_dir / "table_templates.py").write_text(table_templates_code, encoding="utf-8")
        
        if theme_data.get("breakpoints"):
            breakpoints_code = generate_breakpoints_module(theme_data["breakpoints"])
            (theme_dir / "breakpoints.py").write_text(breakpoints_code, encoding="utf-8")
        
        # Create __init__.py for Python package
        init_content = '"""Theme module"""\n'
        (theme_dir / "__init__.py").write_text(init_content, encoding="utf-8")
    
    # Generate main theme.py file
    python_code = generate_theme_class_code(theme_data, parent_class, parent_import, use_modules=use_modules)
    theme_file = theme_dir / "theme.py"
    theme_file.write_text(python_code, encoding="utf-8")
    
    # Extract and save Mustache templates
    save_mustache_templates(theme_dir, theme_data.copy())
    
    # Download and save theme image if present
    image_url = theme_data.get("image")
    if image_url and isinstance(image_url, str) and ("http://" in image_url or "https://" in image_url):
        # Image download will be handled separately in sync_service
        # For now, just note that we need to download it
        pass
    
    # Create README if description exists
    description = theme_data.get("description", "")
    if description:
        readme_file = theme_dir / "README.md"
        readme_content = f"# {theme_data.get('name', 'Theme')}\n\n{description}\n"
        readme_file.write_text(readme_content, encoding="utf-8")

