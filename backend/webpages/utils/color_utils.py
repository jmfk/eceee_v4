"""
Color utility functions for widget rendering.
"""


def resolve_color_value(color_value, theme_colors):
    """
    Convert color name to CSS variable reference if it exists in theme colors.
    Otherwise return the color value as-is (hex, rgb, rgba, etc.)
    
    Args:
        color_value: Color value (name or CSS color string)
        theme_colors: Dict of theme color names (keys are color names)
        
    Returns:
        CSS-ready color value (either var(--name) or the original value)
        
    Examples:
        >>> resolve_color_value("primary", {"primary": "#3b82f6"})
        "var(--primary)"
        >>> resolve_color_value("#3b82f6", {"primary": "#3b82f6"})
        "#3b82f6"
        >>> resolve_color_value("rgb(59, 130, 246)", {})
        "rgb(59, 130, 246)"
    """
    if not color_value:
        return color_value
        
    # Check if this is a theme color name
    if isinstance(color_value, str) and color_value in theme_colors:
        return f"var(--{color_value})"
    
    return color_value

