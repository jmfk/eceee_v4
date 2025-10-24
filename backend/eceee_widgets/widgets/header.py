"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class HeaderConfig(BaseModel):
    """Configuration for Header widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    image: Optional[str] = Field(
        None,
        description="Header image (desktop/main)",
        json_schema_extra={
            "component": "ImageInput",
            "order": 1,
            "mediaTypes": ["image"],
        },
    )

    tablet_image: Optional[str] = Field(
        None,
        description="Header image for tablet (768-1024px)",
        json_schema_extra={
            "component": "ImageInput",
            "order": 2,
            "mediaTypes": ["image"],
        },
    )

    mobile_image: Optional[str] = Field(
        None,
        description="Header image for mobile (<768px)",
        json_schema_extra={
            "component": "ImageInput",
            "order": 3,
            "mediaTypes": ["image"],
        },
    )

    height: Optional[int] = Field(
        112,
        description="Desktop header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 4,
            "min": 40,
            "max": 300,
        },
    )

    tablet_height: Optional[int] = Field(
        112,
        description="Tablet header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 5,
            "min": 40,
            "max": 300,
        },
    )

    mobile_height: Optional[int] = Field(
        80,
        description="Mobile header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 6,
            "min": 40,
            "max": 300,
        },
    )

    alignment: Optional[str] = Field(
        "center",
        description="Image alignment/focal point",
        json_schema_extra={
            "component": "SelectInput",
            "order": 7,
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
        height: var(--header-height-desktop, 112px);
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
    
    /* Mobile breakpoint (<768px) */
    @media (max-width: 767px) {
        .header-widget img {
            height: var(--header-height-mobile, 80px);
        }
    }
    
    /* Tablet breakpoint (768-1024px) */
    @media (min-width: 768px) and (max-width: 1024px) {
        .header-widget img {
            height: var(--header-height-tablet, 112px);
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

        # Get configured heights or use defaults
        mobile_height = config.get("mobile_height") or 80
        tablet_height = config.get("tablet_height") or 112
        desktop_height = config.get("height") or 112

        # Get widths from slot dimensions or use defaults
        mobile_width = dimensions.get("mobile", {}).get("width") or 768
        tablet_width = dimensions.get("tablet", {}).get("width") or 1024
        desktop_width = dimensions.get("desktop", {}).get("width") or 1920

        # Add responsive image settings to config
        template_config["responsive_header"] = {
            "mobile": {
                "width": mobile_width,
                "height": mobile_height,
            },
            "tablet": {
                "width": tablet_width,
                "height": tablet_height,
            },
            "desktop": {
                "width": desktop_width,
                "height": desktop_height,
            },
        }

        return template_config
