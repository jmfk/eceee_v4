"""
Theme Image Validation Service

Validates theme design group images against breakpoint requirements
to ensure optimal display quality for retina (@2x) displays.
"""

import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)


class ThemeImageValidator:
    """Service for validating theme design group images."""

    # Default breakpoints (Tailwind-based)
    DEFAULT_BREAKPOINTS = {
        "xs": 0,
        "sm": 640,
        "md": 768,
        "lg": 1024,
        "xl": 1280,
    }

    def __init__(self, breakpoints: Optional[Dict[str, int]] = None):
        """
        Initialize validator with breakpoint configuration.

        Args:
            breakpoints: Dict of breakpoint names to pixel widths
        """
        self.breakpoints = breakpoints or self.DEFAULT_BREAKPOINTS

    def validate_image_for_breakpoint(
        self,
        image_width: int,
        image_height: int,
        breakpoint_width: int,
        is_2x: bool = True,
    ) -> Dict[str, Any]:
        """
        Validate an image against a specific breakpoint requirement.

        Args:
            image_width: Actual image width in pixels
            image_height: Actual image height in pixels
            breakpoint_width: Breakpoint width in pixels
            is_2x: Whether image is intended for 2x (retina) display

        Returns:
            Dict with validation result:
            {
                "valid": bool,
                "severity": "critical" | "warning" | "info" | "ok",
                "message": str,
                "min_width": int,
                "min_height": int (if calculable),
                "actual_width": int,
                "actual_height": int
            }
        """
        # Calculate minimum required dimensions
        if is_2x:
            min_width = breakpoint_width * 2
        else:
            min_width = breakpoint_width

        result = {
            "actual_width": image_width,
            "actual_height": image_height,
            "min_width": min_width,
            "breakpoint_width": breakpoint_width,
        }

        # Determine severity and message
        if image_width < breakpoint_width:
            # Critical: Image smaller than even 1x display
            result["valid"] = False
            result["severity"] = "critical"
            result["message"] = (
                f"Image is too small ({image_width}px wide). "
                f"Will appear blurry even at standard resolution. "
                f"Minimum required: {breakpoint_width}px for 1x display."
            )
        elif image_width < min_width:
            # Warning: Image smaller than 2x requirement
            result["valid"] = False
            result["severity"] = "warning"
            result["message"] = (
                f"Image is {image_width}px wide but should be at least {min_width}px "
                f"({breakpoint_width}px × 2) for optimal retina display. "
                f"Retina screens will not get full quality."
            )
        elif image_width < breakpoint_width * 3:
            # Info: Adequate but not excessive
            result["valid"] = True
            result["severity"] = "info"
            result["message"] = (
                f"Image size is adequate ({image_width}px) for retina display "
                f"at this breakpoint ({breakpoint_width}px)."
            )
        else:
            # OK: More than sufficient
            result["valid"] = True
            result["severity"] = "ok"
            result["message"] = f"Image size is optimal ({image_width}px)."

        return result

    def validate_design_group_images(
        self, design_groups: Dict[str, Any], breakpoints: Optional[Dict[str, int]] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Validate all images in design groups against breakpoint requirements.

        Args:
            design_groups: Design groups data structure
            breakpoints: Optional breakpoint overrides

        Returns:
            Dict of warnings keyed by image location:
            {
                "group-0-hero-widget-lg-background": [
                    {
                        "severity": "warning",
                        "message": "...",
                        "breakpoint": "lg",
                        "breakpoint_width": 1024,
                        ...
                    }
                ]
            }
        """
        if not design_groups or "groups" not in design_groups:
            return {}

        # Use provided breakpoints or instance defaults
        bps = breakpoints or self.breakpoints
        warnings = {}

        groups = design_groups.get("groups", [])

        for group_index, group in enumerate(groups):
            layout_properties = group.get("layoutProperties", {})

            for part, part_breakpoints in layout_properties.items():
                for bp_key, bp_props in part_breakpoints.items():
                    # Skip if not a standard breakpoint
                    if bp_key not in bps:
                        continue

                    # Check for images in this breakpoint
                    images = bp_props.get("images", {})
                    if not isinstance(images, dict):
                        continue

                    breakpoint_width = bps[bp_key]

                    for image_key, image_data in images.items():
                        if not isinstance(image_data, dict):
                            continue

                        # Extract dimensions
                        width = image_data.get("width")
                        height = image_data.get("height")

                        if not width or not height:
                            # No dimensions available - skip validation
                            continue

                        # Validate image
                        validation = self.validate_image_for_breakpoint(
                            image_width=width,
                            image_height=height,
                            breakpoint_width=breakpoint_width,
                            is_2x=True,
                        )

                        # Only include warnings and critical issues
                        if validation["severity"] in ["critical", "warning"]:
                            warning_key = f"group-{group_index}-{part}-{bp_key}-{image_key}"
                            
                            warning_data = {
                                "severity": validation["severity"],
                                "message": validation["message"],
                                "breakpoint": bp_key,
                                "breakpoint_width": breakpoint_width,
                                "min_width": validation["min_width"],
                                "actual_width": validation["actual_width"],
                                "actual_height": validation["actual_height"],
                                "part": part,
                                "image_key": image_key,
                                "group_index": group_index,
                            }

                            if warning_key not in warnings:
                                warnings[warning_key] = []
                            
                            warnings[warning_key].append(warning_data)

        logger.info(f"Image validation found {len(warnings)} warnings")
        return warnings

    def get_minimum_dimensions_for_breakpoints(
        self, breakpoints_used: List[str], is_2x: bool = True
    ) -> Tuple[int, Optional[int]]:
        """
        Calculate minimum image dimensions needed for a set of breakpoints.

        Args:
            breakpoints_used: List of breakpoint keys (e.g., ['sm', 'md', 'lg'])
            is_2x: Whether calculating for 2x (retina) display

        Returns:
            Tuple of (min_width, min_height)
            min_height is None if aspect ratio is unknown
        """
        if not breakpoints_used:
            return (0, None)

        # Find the largest breakpoint
        max_bp_width = max(
            self.breakpoints.get(bp, 0) for bp in breakpoints_used
        )

        if is_2x:
            min_width = max_bp_width * 2
        else:
            min_width = max_bp_width

        return (min_width, None)


