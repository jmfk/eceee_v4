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

    # Mobile settings (grouped)
    mobile_image: Optional[dict] = Field(
        None,
        description="MediaFile object for mobile header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 1,
            "mediaTypes": ["image"],
            "group": "mobile",
            "allowCollections": False,
            "multiple": False,
        },
    )

    mobile_width: Optional[int] = Field(
        640,
        description="Mobile breakpoint width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 2,
            "min": 320,
            "max": 1024,
            "group": "mobile",
        },
    )

    mobile_height: Optional[int] = Field(
        80,
        description="Mobile header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 3,
            "min": 40,
            "max": 300,
            "group": "mobile",
        },
    )

    mobile_alignment: Optional[str] = Field(
        "center",
        description="Mobile image alignment/focal point",
        json_schema_extra={
            "component": "SelectInput",
            "order": 4,
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
                {"value": "right", "label": "Right"},
            ],
            "group": "mobile",
        },
    )

    # Tablet settings (grouped)
    tablet_image: Optional[dict] = Field(
        None,
        description="MediaFile object for tablet header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 5,
            "mediaTypes": ["image"],
            "group": "tablet",
            "allowCollections": False,
            "multiple": False,
        },
    )

    tablet_width: Optional[int] = Field(
        1024,
        description="Tablet breakpoint width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 6,
            "min": 640,
            "max": 1920,
            "group": "tablet",
        },
    )

    tablet_height: Optional[int] = Field(
        112,
        description="Tablet header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 7,
            "min": 40,
            "max": 300,
            "group": "tablet",
        },
    )

    tablet_alignment: Optional[str] = Field(
        "center",
        description="Tablet image alignment/focal point",
        json_schema_extra={
            "component": "SelectInput",
            "order": 8,
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
                {"value": "right", "label": "Right"},
            ],
            "group": "tablet",
        },
    )

    # Desktop settings (grouped)
    image: Optional[dict] = Field(
        None,
        description="MediaFile object for desktop header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 9,
            "mediaTypes": ["image"],
            "group": "desktop",
        },
    )

    width: Optional[int] = Field(
        1280,
        description="Desktop breakpoint width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 10,
            "min": 1024,
            "max": 3840,
            "group": "desktop",
        },
    )

    height: Optional[int] = Field(
        112,
        description="Desktop header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 11,
            "min": 40,
            "max": 300,
            "group": "desktop",
        },
    )

    alignment: Optional[str] = Field(
        "center",
        description="Desktop image alignment/focal point",
        json_schema_extra={
            "component": "SelectInput",
            "order": 12,
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
                {"value": "right", "label": "Right"},
            ],
            "group": "desktop",
        },
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    name = "Header"
    description = (
        "Simple header widget with responsive image that scales to fill header height"
    )
    template_name = "easy_widgets/widgets/header.html"

    widget_css = """
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig

    def render_with_style(self, config, theme):
        """
        Render header with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )
        from django.template.loader import render_to_string

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the header HTML using the default template first
        header_html = render_to_string(self.template_name, {"config": prepared_config})

        # Prepare context with rendered header as content
        context = prepare_component_context(
            content=header_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css

    def prepare_template_context(self, config, context=None):
        """Build header background styling with fixed dimensions"""
        from file_manager.imgproxy import imgproxy_service

        template_config = super().prepare_template_context(config, context)

        # Build complete inline style string
        style_parts = []

        # Get configuration values with defaults
        mobile_width = config.get("mobile_width", 640)
        mobile_height = config.get("mobile_height", 80)
        mobile_alignment = config.get("mobile_alignment", "center")

        tablet_width = config.get("tablet_width", 1024)
        tablet_height = config.get("tablet_height", 112)
        tablet_alignment = config.get("tablet_alignment", "center")

        desktop_width = config.get("width", 1280)
        desktop_height = config.get("height", 112)
        desktop_alignment = config.get("alignment", "center")

        # Get images
        image = config.get("image")
        mobile_image = config.get("mobile_image")
        tablet_image = config.get("tablet_image")

        # Generate desktop image URL (1x and 2x)
        desktop_url = None
        desktop_url_2x = None
        if image:
            imgproxy_base_url = image.get("imgproxy_base_url")
            desktop_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=desktop_width,
                height=desktop_height,
                resize_type="fill",
            )
            desktop_url_2x = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=desktop_width * 2,
                height=desktop_height * 2,
                resize_type="fill",
            )
            if desktop_url and desktop_url_2x:
                style_parts.append(f"--desktop-bg-image: image-set(url('{desktop_url}') 1x, url('{desktop_url_2x}') 2x);")
            elif desktop_url:
                style_parts.append(f"--desktop-bg-image: url('{desktop_url}');")

        # Generate tablet image URL (1x and 2x, fallback to desktop if not specified)
        tablet_url = None
        tablet_url_2x = None
        if tablet_image:
            imgproxy_base_url = tablet_image.get("imgproxy_base_url")
            tablet_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=tablet_width,
                height=tablet_height,
                resize_type="fill",
            )
            tablet_url_2x = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=tablet_width * 2,
                height=tablet_height * 2,
                resize_type="fill",
            )
        if tablet_url and tablet_url_2x:
            style_parts.append(f"--tablet-bg-image: image-set(url('{tablet_url}') 1x, url('{tablet_url_2x}') 2x);")
        elif tablet_url:
            style_parts.append(f"--tablet-bg-image: url('{tablet_url}');")
        elif desktop_url and desktop_url_2x:
            style_parts.append(f"--tablet-bg-image: image-set(url('{desktop_url}') 1x, url('{desktop_url_2x}') 2x);")
        elif desktop_url:
            style_parts.append(f"--tablet-bg-image: url('{desktop_url}');")

        # Generate mobile image URL (1x and 2x, fallback to tablet or desktop if not specified)
        mobile_url = None
        mobile_url_2x = None
        if mobile_image:
            imgproxy_base_url = mobile_image.get("imgproxy_base_url")
            mobile_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=mobile_width,
                height=mobile_height,
                resize_type="fill",
            )
            mobile_url_2x = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=mobile_width * 2,
                height=mobile_height * 2,
                resize_type="fill",
            )
        if mobile_url and mobile_url_2x:
            style_parts.append(f"--mobile-bg-image: image-set(url('{mobile_url}') 1x, url('{mobile_url_2x}') 2x);")
        elif mobile_url:
            style_parts.append(f"--mobile-bg-image: url('{mobile_url}');")
        elif tablet_url and tablet_url_2x:
            style_parts.append(f"--mobile-bg-image: image-set(url('{tablet_url}') 1x, url('{tablet_url_2x}') 2x);")
        elif tablet_url:
            style_parts.append(f"--mobile-bg-image: url('{tablet_url}');")
        elif desktop_url and desktop_url_2x:
            style_parts.append(f"--mobile-bg-image: image-set(url('{desktop_url}') 1x, url('{desktop_url_2x}') 2x);")
        elif desktop_url:
            style_parts.append(f"--mobile-bg-image: url('{desktop_url}');")

        # Add fixed heights as CSS variables
        style_parts.append(f"--mobile-height: {mobile_height}px;")
        style_parts.append(f"--tablet-height: {tablet_height}px;")
        style_parts.append(f"--desktop-height: {desktop_height}px;")

        # Add alignment as CSS variables (with two-value syntax)
        style_parts.append(f"--mobile-alignment: {mobile_alignment} center;")
        style_parts.append(f"--tablet-alignment: {tablet_alignment} center;")
        style_parts.append(f"--desktop-alignment: {desktop_alignment} center;")

        # Join all style parts
        template_config["header_style"] = " ".join(style_parts)

        # Pass breakpoint widths to template for media queries
        template_config["mobile_width"] = mobile_width
        template_config["tablet_width"] = tablet_width

        return template_config
