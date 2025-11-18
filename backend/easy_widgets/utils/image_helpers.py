"""
Image dimension validation and processing helpers for widgets.
"""

import logging
from typing import Tuple, Optional, Dict, Any

logger = logging.getLogger(__name__)


def validate_image_dimensions(
    image_obj: Any, requested_width: int, requested_height: int
) -> Tuple[int, int, Optional[str]]:
    """
    Validate and constrain image dimensions to prevent upscaling.

    Args:
        image_obj: Image object (MediaFile model, dict, or string URL)
        requested_width: Desired width in pixels
        requested_height: Desired height in pixels

    Returns:
        Tuple of (constrained_width, constrained_height, warning_message)
        warning_message is None if no issues, otherwise contains info about constraints
    """
    # Extract original dimensions from image object
    original_width, original_height = _extract_dimensions(image_obj)

    # If no original dimensions available, return requested dimensions
    if not original_width or not original_height:
        logger.warning(
            f"No original dimensions found for image, using requested: "
            f"{requested_width}x{requested_height}"
        )
        return requested_width, requested_height, None

    # Check if requested dimensions would require upscaling
    width_scale = requested_width / original_width
    height_scale = requested_height / original_height

    # For "fill" resize type, we need to ensure at least one dimension fits
    # The larger scale determines if we need to upscale
    max_scale = max(width_scale, height_scale)

    if max_scale > 1.0:
        # Would require upscaling - constrain to original dimensions
        # Maintain aspect ratio of requested dimensions
        requested_aspect = requested_width / requested_height
        original_aspect = original_width / original_height

        if requested_aspect > original_aspect:
            # Requested is wider - constrain by width
            constrained_width = original_width
            constrained_height = int(original_width / requested_aspect)
        else:
            # Requested is taller - constrain by height
            constrained_height = original_height
            constrained_width = int(original_height * requested_aspect)

        warning = (
            f"Image too small for requested dimensions. "
            f"Original: {original_width}x{original_height}, "
            f"Requested: {requested_width}x{requested_height}, "
            f"Using: {constrained_width}x{constrained_height}"
        )
        logger.debug(warning)
        return constrained_width, constrained_height, warning

    return requested_width, requested_height, None


def get_image_dimensions_with_2x(
    image_obj: Any, base_width: int, base_height: int
) -> Tuple[int, int, int, int, bool]:
    """
    Get image dimensions for both 1x and 2x (retina) versions.

    Args:
        image_obj: Image object (MediaFile model, dict, or string URL)
        base_width: Base width in pixels (1x)
        base_height: Base height in pixels (1x)

    Returns:
        Tuple of (width_1x, height_1x, width_2x, height_2x, has_2x_available)
        has_2x_available is True if source image can support 2x version
    """
    # Extract original dimensions
    original_width, original_height = _extract_dimensions(image_obj)

    # If no original dimensions, assume 2x is available
    if not original_width or not original_height:
        logger.warning(
            f"No original dimensions found, assuming 2x is available for "
            f"{base_width}x{base_height}"
        )
        return base_width, base_height, base_width * 2, base_height * 2, True

    # Validate 1x dimensions
    width_1x, height_1x, warning_1x = validate_image_dimensions(
        image_obj, base_width, base_height
    )

    # Check if 2x is available
    width_2x_requested = base_width * 2
    height_2x_requested = base_height * 2

    width_2x, height_2x, warning_2x = validate_image_dimensions(
        image_obj, width_2x_requested, height_2x_requested
    )

    # Determine if true 2x is available
    has_2x = (width_2x == width_2x_requested) and (height_2x == height_2x_requested)

    if not has_2x:
        logger.debug(
            f"2x version not available for {base_width}x{base_height}. "
            f"Original: {original_width}x{original_height}, "
            f"Using max available: {width_2x}x{height_2x}"
        )

    return width_1x, height_1x, width_2x, height_2x, has_2x


def _extract_dimensions(image_obj: Any) -> Tuple[Optional[int], Optional[int]]:
    """
    Extract width and height from various image object types.

    Args:
        image_obj: Image object (MediaFile model, dict, or string URL)

    Returns:
        Tuple of (width, height) or (None, None) if not found
    """
    # Handle dict (from serializer)
    if isinstance(image_obj, dict):
        width = image_obj.get("width")
        height = image_obj.get("height")
        if width is not None and height is not None:
            return int(width), int(height)
        return None, None

    # Handle model instance with attributes
    if hasattr(image_obj, "width") and hasattr(image_obj, "height"):
        width = getattr(image_obj, "width", None)
        height = getattr(image_obj, "height", None)
        if width is not None and height is not None:
            return int(width), int(height)
        return None, None

    # String URL - can't extract dimensions
    if isinstance(image_obj, str):
        return None, None

    return None, None


