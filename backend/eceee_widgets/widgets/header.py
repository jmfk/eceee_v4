"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field

from webpages.widget_registry import BaseWidget, register_widget_type


class HeaderConfig(BaseModel):
    """Configuration for Header widget"""

    image: Optional[str] = Field(
        None,
        description="Header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 1,
            "mediaTypes": ["image"],
        },
    )

    alignment: Optional[str] = Field(
        "center",
        description="Image alignment/focal point",
        json_schema_extra={
            "component": "SelectInput",
            "order": 2,
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
                {"value": "right", "label": "Right"},
            ],
        },
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    name = "Header"
    description = (
        "Simple header widget with responsive image that scales to fill header height"
    )
    template_name = "eceee_widgets/widgets/header.html"

    widget_css = """
    .header-widget {
        width: 100%;
        display: block;
        overflow: hidden;
        position: relative;
    }
    
    .header-widget img {
        width: 100%;
        /* Responsive height: scales from 60px at mobile to 132px at desktop */
        height: clamp(60px, 12vw, 132px) !important;
        object-fit: cover;
        display: block;
    }
    
    /* Alignment classes for object-position */
    .header-widget img.align-left {
        object-position: left center;
    }
    
    .header-widget img.align-center {
        object-position: center center;
    }
    
    .header-widget img.align-right {
        object-position: right center;
    }
    
    /* Ensure minimum height on very small screens */
    @media (max-width: 375px) {
        .header-widget img {
            height: 60px !important;
        }
    }
    
    /* Cap at max height on large screens */
    @media (min-width: 1200px) {
        .header-widget img {
            height: 132px !important;
        }
    }
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig

    def prepare_template_context(self, config, context=None):
        """Add responsive image dimensions to context"""
        template_config = super().prepare_template_context(config, context)

        # Get widget dimensions from slot
        dimensions = self.get_widget_dimensions(context)

        # Define responsive header heights
        header_heights = {
            "mobile": 80,  # Shorter header for mobile
            "tablet": 132,  # Standard header height
            "desktop": 132,  # Standard header height
        }

        # Get widths from slot dimensions or use defaults
        mobile_width = dimensions.get("mobile", {}).get("width") or 360
        tablet_width = dimensions.get("tablet", {}).get("width") or 768
        desktop_width = dimensions.get("desktop", {}).get("width") or 1280

        # Add responsive image settings to config
        template_config["responsive_header"] = {
            "mobile": {
                "width": mobile_width,
                "height": header_heights["mobile"],
            },
            "tablet": {
                "width": tablet_width,
                "height": header_heights["tablet"],
            },
            "desktop": {
                "width": desktop_width,
                "height": header_heights["desktop"],
            },
        }

        return template_config
