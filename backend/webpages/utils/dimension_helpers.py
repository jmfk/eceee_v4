"""
Utility functions for slot and widget dimension calculations.

This module provides helper functions for working with responsive dimensions
in layouts and container widgets.
"""

from typing import Dict, Optional, Any


# Standard responsive breakpoints (matching Tailwind CSS conventions)
BREAKPOINTS = {
    "mobile": {
        "name": "mobile",
        "max_width": 640,
        "description": "Mobile devices (< 640px)",
    },
    "tablet": {
        "name": "tablet",
        "min_width": 640,
        "max_width": 1024,
        "description": "Tablets (640-1024px)",
    },
    "desktop": {
        "name": "desktop",
        "min_width": 1024,
        "description": "Desktop (> 1024px)",
    },
}


def create_dimension_dict(
    mobile_width: Optional[int] = None,
    tablet_width: Optional[int] = None,
    desktop_width: Optional[int] = None,
    mobile_height: Optional[int] = None,
    tablet_height: Optional[int] = None,
    desktop_height: Optional[int] = None,
) -> Dict[str, Dict[str, Optional[int]]]:
    """
    Create a standard dimension dictionary for all breakpoints.

    Args:
        mobile_width: Width in pixels for mobile devices
        tablet_width: Width in pixels for tablets
        desktop_width: Width in pixels for desktop
        mobile_height: Height in pixels for mobile devices
        tablet_height: Height in pixels for tablets
        desktop_height: Height in pixels for desktop

    Returns:
        Dictionary with dimensions per breakpoint

    Example:
        >>> create_dimension_dict(mobile_width=360, tablet_width=768, desktop_width=896)
        {
            "mobile": {"width": 360, "height": None},
            "tablet": {"width": 768, "height": None},
            "desktop": {"width": 896, "height": None}
        }
    """
    return {
        "mobile": {"width": mobile_width, "height": mobile_height},
        "tablet": {"width": tablet_width, "height": tablet_height},
        "desktop": {"width": desktop_width, "height": desktop_height},
    }


def calculate_slot_dimensions(
    parent_dimensions: Dict[str, Dict[str, Optional[int]]],
    slot_fraction: float,
) -> Dict[str, Dict[str, Optional[int]]]:
    """
    Calculate slot dimensions as a fraction of parent dimensions.

    Useful for container widgets that split their space (e.g., two columns at 0.5 each).

    Args:
        parent_dimensions: Parent widget's dimensions per breakpoint
        slot_fraction: Fraction of parent width (0.0 to 1.0)

    Returns:
        Calculated dimensions per breakpoint

    Example:
        >>> parent_dims = create_dimension_dict(mobile_width=360, desktop_width=896)
        >>> calculate_slot_dimensions(parent_dims, 0.5)
        {
            "mobile": {"width": 180, "height": None},
            "tablet": {"width": None, "height": None},
            "desktop": {"width": 448, "height": None}
        }
    """
    result = {}

    for breakpoint in ["mobile", "tablet", "desktop"]:
        parent = parent_dimensions.get(breakpoint, {})
        parent_width = parent.get("width")

        if parent_width:
            calculated_width = int(parent_width * slot_fraction)
        else:
            calculated_width = None

        result[breakpoint] = {
            "width": calculated_width,
            "height": None,  # Height is usually auto for content flow
        }

    return result


def calculate_multi_column_dimensions(
    parent_dimensions: Dict[str, Dict[str, Optional[int]]],
    num_columns: int,
    gap: int = 16,
) -> Dict[str, Dict[str, Optional[int]]]:
    """
    Calculate dimensions for one column in a multi-column layout with gaps.

    Args:
        parent_dimensions: Parent widget's dimensions per breakpoint
        num_columns: Number of columns
        gap: Gap between columns in pixels (default: 16px = 1rem)

    Returns:
        Calculated dimensions for one column per breakpoint

    Example:
        >>> parent_dims = create_dimension_dict(desktop_width=896)
        >>> calculate_multi_column_dimensions(parent_dims, num_columns=2, gap=16)
        {
            "mobile": {"width": None, "height": None},
            "tablet": {"width": None, "height": None},
            "desktop": {"width": 440, "height": None}  # (896 - 16) / 2
        }
    """
    result = {}

    for breakpoint in ["mobile", "tablet", "desktop"]:
        parent = parent_dimensions.get(breakpoint, {})
        parent_width = parent.get("width")

        if parent_width:
            # Total gap space: (num_columns - 1) * gap
            total_gap = (num_columns - 1) * gap
            available_width = parent_width - total_gap
            column_width = int(available_width / num_columns)
        else:
            column_width = None

        result[breakpoint] = {
            "width": column_width,
            "height": None,
        }

    return result


def get_dimension_for_breakpoint(
    dimensions: Dict[str, Dict[str, Optional[int]]],
    breakpoint: str = "desktop",
) -> Dict[str, Optional[int]]:
    """
    Get dimensions for a specific breakpoint.

    Args:
        dimensions: Dimensions dict with all breakpoints
        breakpoint: Breakpoint name (mobile, tablet, desktop)

    Returns:
        Dimensions for the specified breakpoint

    Example:
        >>> dims = create_dimension_dict(mobile_width=360, desktop_width=896)
        >>> get_dimension_for_breakpoint(dims, "desktop")
        {"width": 896, "height": None}
    """
    return dimensions.get(breakpoint, {"width": None, "height": None})


def merge_dimensions(
    base_dimensions: Dict[str, Dict[str, Optional[int]]],
    override_dimensions: Dict[str, Dict[str, Optional[int]]],
) -> Dict[str, Dict[str, Optional[int]]]:
    """
    Merge two dimension dictionaries, with override taking precedence.

    Args:
        base_dimensions: Base dimensions
        override_dimensions: Override dimensions (takes precedence)

    Returns:
        Merged dimensions
    """
    result = {}

    for breakpoint in ["mobile", "tablet", "desktop"]:
        base = base_dimensions.get(breakpoint, {})
        override = override_dimensions.get(breakpoint, {})

        result[breakpoint] = {
            "width": (
                override.get("width")
                if override.get("width") is not None
                else base.get("width")
            ),
            "height": (
                override.get("height")
                if override.get("height") is not None
                else base.get("height")
            ),
        }

    return result


def format_dimensions_for_display(
    dimensions: Dict[str, Dict[str, Optional[int]]],
) -> str:
    """
    Format dimensions as a human-readable string for debugging.

    Args:
        dimensions: Dimensions dict

    Returns:
        Formatted string

    Example:
        >>> dims = create_dimension_dict(mobile_width=360, desktop_width=896)
        >>> format_dimensions_for_display(dims)
        "mobile: 360x? | tablet: ?x? | desktop: 896x?"
    """
    parts = []
    for breakpoint in ["mobile", "tablet", "desktop"]:
        dims = dimensions.get(breakpoint, {})
        width = dims.get("width") or "?"
        height = dims.get("height") or "?"
        parts.append(f"{breakpoint}: {width}x{height}")

    return " | ".join(parts)
