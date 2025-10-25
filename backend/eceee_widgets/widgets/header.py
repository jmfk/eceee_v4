"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from utils.dict_utils import DictToObj

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
        description="Header image for tablet (640-1024px)",
        json_schema_extra={
            "component": "ImageInput",
            "order": 2,
            "mediaTypes": ["image"],
        },
    )

    mobile_image: Optional[str] = Field(
        None,
        description="Header image for mobile (<640px)",
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
        "left",
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
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig

    def prepare_template_context(self, config, context=None):
        """Build header background styling"""
        from file_manager.imgproxy import imgproxy_service

        template_config = super().prepare_template_context(config, context)
        context = DictToObj(context)

        # Build complete inline style string
        style_parts = []

        # Get responsive heights - can be None for auto-height behavior
        mobile_height = config.get("mobile_height")  # Can be None
        tablet_height = config.get("tablet_height")  # Can be None
        desktop_height = config.get("height", 112)  # Always has default

        # Generate image URLs for each breakpoint
        image = config.get("image")
        mobile_image = config.get("mobile_image")
        tablet_image = config.get("tablet_image")
        alignment = config.get("alignment", "left")

        # Desktop image (main image)
        desktop_url = None
        if image:
            imgproxy_base_url = image.get("imgproxy_base_url")
            desktop_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=context.slot.dimensions.desktop.width,
                height=desktop_height,
                resize_type="fill",
            )
            if desktop_url:
                style_parts.append(f"--desktop-bg-image: url('{desktop_url}');")

        # Tablet image (use tablet_image if available, else fallback to main image)
        tablet_url = None
        if tablet_image:
            imgproxy_base_url = tablet_image.get("imgproxy_base_url")
            if tablet_height:
                # Fixed height behavior
                tablet_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=context.slot.dimensions.tablet.width,
                    height=tablet_height,
                    resize_type="fill",
                )
            else:
                # Cover/auto-height behavior - only specify width
                tablet_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=context.slot.dimensions.tablet.width,
                    resize_type="fit",  # Preserve aspect ratio
                )
        if tablet_url:
            style_parts.append(f"--tablet-bg-image: url('{tablet_url}');")
        elif desktop_url:
            style_parts.append(f"--tablet-bg-image: url('{desktop_url}');")

        # Mobile image (use mobile_image if available, else fallback to tablet/desktop)
        mobile_url = None
        if mobile_image:
            imgproxy_base_url = mobile_image.get("imgproxy_base_url")
            if mobile_height:
                # Fixed height behavior
                mobile_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=context.slot.dimensions.mobile.width,
                    height=mobile_height,
                    resize_type="fill",
                )
            else:
                # Cover/auto-height behavior - only specify width
                mobile_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=context.slot.dimensions.mobile.width,
                    resize_type="fit",  # Preserve aspect ratio
                )
        if mobile_url:
            style_parts.append(f"--mobile-bg-image: url('{mobile_url}');")
        elif tablet_url:
            style_parts.append(f"--mobile-bg-image: url('{tablet_url}');")
        elif desktop_url:
            style_parts.append(f"--mobile-bg-image: url('{desktop_url}');")

        # Add responsive heights and alignment as CSS variables
        if mobile_height:
            style_parts.append(f"--mobile-height: {mobile_height}px;")
        if tablet_height:
            style_parts.append(f"--tablet-height: {tablet_height}px;")
        style_parts.append(f"--desktop-height: {desktop_height}px;")
        # Use two-value syntax for background-position (horizontal vertical)
        style_parts.append(f"--bg-alignment: {alignment} center;")

        # Join all style parts
        template_config["header_style"] = " ".join(style_parts)

        # Pass height values to template for conditional classes
        template_config["mobile_height"] = mobile_height
        template_config["tablet_height"] = tablet_height

        return template_config
