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
    mobile_width: int = Field(
        640,
        description="Mobile header width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 2,
            "group": "mobile",
            "min": 1,
        },
    )
    mobile_height: int = Field(
        80,
        description="Mobile header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 3,
            "group": "mobile",
            "min": 1,
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
    tablet_width: int = Field(
        1024,
        description="Tablet header width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 6,
            "group": "tablet",
            "min": 1,
        },
    )
    tablet_height: int = Field(
        112,
        description="Tablet header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 7,
            "group": "tablet",
            "min": 1,
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
    width: int = Field(
        1280,
        description="Desktop header width in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 10,
            "group": "desktop",
            "min": 1,
        },
    )
    height: int = Field(
        112,
        description="Desktop header height in pixels",
        json_schema_extra={
            "component": "NumberInput",
            "order": 11,
            "group": "desktop",
            "min": 1,
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

    layout_parts = {
        "header-widget": {
            "label": "Header container",
            "selector": ".header-widget",
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
            ],
        },
    }

    widget_css = """
        .widget-type-header {
            width: 100%;
            background-image: var(--mobile-bg-image);
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
            aspect-ratio: var(--mobile-header-ar, 640 / 80);
        }

        @media (min-width: 640px) {
            .widget-type-header {
                background-image: var(--tablet-bg-image);
                height: var(--tablet-header-h, 112px);
                aspect-ratio: auto;
                background-size: auto 100%;
                background-position: top left;
            }
        }

        @media (min-width: 1024px) {
            .widget-type-header {
                background-image: var(--desktop-bg-image);
                height: var(--desktop-header-h, 112px);
                aspect-ratio: auto;
                background-size: auto 100%;
                background-position: top left;
            }
        }
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
        """Build header background styling with original images (no resizing)"""

        def _build_image_var(
            *,
            css_var_name: str,
            image_obj: Optional[dict],
        ) -> Optional[str]:
            """Build CSS variable using original image URL (no resizing)"""
            if not image_obj:
                return None

            # Extract original URL directly (no imgproxy resizing)
            original_url = image_obj.get("imgproxy_base_url") or image_obj.get(
                "file_url"
            )
            if not original_url:
                return None

            # Use original URL as-is
            return f"{css_var_name}: url('{original_url}');"

        template_config = super().prepare_template_context(config, context)

        # Build complete inline style string
        style_parts = []

        # Get manual dimensions from config (with defaults)
        mobile_width = config.get("mobile_width", 640)
        mobile_height = config.get("mobile_height", 80)
        tablet_width = config.get("tablet_width", 1024)
        tablet_height = config.get("tablet_height", 112)
        desktop_width = config.get("width", 1280)
        desktop_height = config.get("height", 112)

        # Get images
        image = config.get("image")
        mobile_image = config.get("mobile_image")
        tablet_image = config.get("tablet_image")

        # Determine breakpoint sources (fallback chain)
        tablet_source = tablet_image or image
        mobile_source = mobile_image or tablet_image or image

        # Desktop (uses desktop image only)
        desktop_style = _build_image_var(
            css_var_name="--desktop-bg-image",
            image_obj=image,
        )
        if desktop_style:
            style_parts.append(desktop_style)

        # Tablet (fallback to desktop image)
        tablet_style = _build_image_var(
            css_var_name="--tablet-bg-image",
            image_obj=tablet_source,
        )
        if tablet_style:
            style_parts.append(tablet_style)

        # Mobile (fallback to tablet, then desktop)
        mobile_style = _build_image_var(
            css_var_name="--mobile-bg-image",
            image_obj=mobile_source,
        )
        if mobile_style:
            style_parts.append(mobile_style)

        # Aspect ratios (always emitted; use manual dimensions)
        style_parts.append(f"--desktop-header-ar: {desktop_width} / {desktop_height};")
        style_parts.append(f"--tablet-header-ar: {tablet_width} / {tablet_height};")
        style_parts.append(f"--mobile-header-ar: {mobile_width} / {mobile_height};")

        # Fixed heights for tablet/desktop (mobile remains responsive via aspect-ratio)
        style_parts.append(f"--tablet-header-h: {tablet_height}px;")
        style_parts.append(f"--desktop-header-h: {desktop_height}px;")

        # Join all style parts
        template_config["header_style"] = " ".join(style_parts)

        return template_config
