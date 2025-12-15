"""
Header widget implementation.
"""

from typing import Type, Optional, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from utils.dict_utils import DictToObj

from webpages.widget_registry import BaseWidget, register_widget_type


class BreakpointConfig(BaseModel):
    """Configuration for a single breakpoint"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    image: Optional[dict] = Field(
        None,
        description="MediaFile object for header image at this breakpoint",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "allowCollections": False,
            "multiple": False,
        },
    )
    width: int = Field(
        ...,
        description="Min-width in pixels for this breakpoint (media query threshold)",
        json_schema_extra={
            "component": "NumberInput",
            "min": 1,
        },
    )
    height: int = Field(
        ...,
        description="Header height in pixels for this breakpoint",
        json_schema_extra={
            "component": "NumberInput",
            "min": 1,
        },
    )


class HeaderConfig(BaseModel):
    """Configuration for Header widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    breakpoints: List[BreakpointConfig] = Field(
        default_factory=lambda: [
            BreakpointConfig(image=None, width=640, height=80),   # Mobile
            BreakpointConfig(image=None, width=1024, height=112),  # Tablet
            BreakpointConfig(image=None, width=1280, height=112),  # Desktop
        ],
        description="List of responsive breakpoints with image, width, and height",
        json_schema_extra={
            "component": "ReorderableListInput",
            "allowAdd": True,
            "allowRemove": True,
            "allowReorder": True,
            "itemTemplate": {"image": None, "width": 640, "height": 80},
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

    @property
    def widget_css(self):
        """Generate CSS dynamically based on breakpoints"""
        # This will be populated by prepare_template_context with actual breakpoints
        # For now, return base CSS that will be enhanced with variables
        return """
        .widget-type-header {
            width: 100%;
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
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

        # Handle migration from old format to new format
        breakpoints = config.get("breakpoints", [])
        
        # If breakpoints is empty or not in new format, migrate from old format
        if not breakpoints or (isinstance(breakpoints, list) and len(breakpoints) == 0):
            # Check for old format fields
            if "mobile_width" in config or "tablet_width" in config or "width" in config:
                breakpoints = []
                # Mobile
                if "mobile_width" in config or "mobile_image" in config:
                    breakpoints.append({
                        "image": config.get("mobile_image"),
                        "width": config.get("mobile_width", 640),
                        "height": config.get("mobile_height", 80),
                    })
                # Tablet
                if "tablet_width" in config or "tablet_image" in config:
                    breakpoints.append({
                        "image": config.get("tablet_image"),
                        "width": config.get("tablet_width", 1024),
                        "height": config.get("tablet_height", 112),
                    })
                # Desktop
                if "width" in config or "image" in config:
                    breakpoints.append({
                        "image": config.get("image"),
                        "width": config.get("width", 1280),
                        "height": config.get("height", 112),
                    })
                
                # If still empty, use defaults
                if not breakpoints:
                    breakpoints = [
                        {"image": None, "width": 640, "height": 80},
                        {"image": None, "width": 1024, "height": 112},
                        {"image": None, "width": 1280, "height": 112},
                    ]

        # Ensure breakpoints is a list of dicts
        if not isinstance(breakpoints, list):
            breakpoints = []

        # Convert to list of dicts if needed (handle Pydantic models)
        breakpoint_dicts = []
        for bp in breakpoints:
            if isinstance(bp, dict):
                breakpoint_dicts.append(bp)
            else:
                # Pydantic model or similar - try to convert to dict
                try:
                    # Try Pydantic v2 method first
                    if hasattr(bp, "model_dump"):
                        bp_dict = bp.model_dump()
                    # Try Pydantic v1 method
                    elif hasattr(bp, "dict"):
                        bp_dict = bp.dict()
                    # Fallback to accessing attributes directly
                    else:
                        bp_dict = {
                            "image": getattr(bp, "image", None),
                            "width": getattr(bp, "width", 640),
                            "height": getattr(bp, "height", 80),
                        }
                    breakpoint_dicts.append(bp_dict)
                except Exception:
                    # Last resort: build dict manually
                    breakpoint_dicts.append({
                        "image": getattr(bp, "image", None),
                        "width": getattr(bp, "width", 640),
                        "height": getattr(bp, "height", 80),
                    })

        # Sort breakpoints by width (ascending) for proper CSS media query ordering
        breakpoint_dicts.sort(key=lambda x: x.get("width", 0))

        # Build complete inline style string
        style_parts = []

        # Build image fallback chain (each breakpoint falls back to previous)
        last_image = None
        for idx, bp in enumerate(breakpoint_dicts):
            bp_image = bp.get("image") or last_image
            bp_width = bp.get("width", 640)
            bp_height = bp.get("height", 80)

            # Build CSS variable for this breakpoint's image
            css_var_name = f"--breakpoint-{idx}-bg-image"
            image_style = _build_image_var(
                css_var_name=css_var_name,
                image_obj=bp_image,
            )
            if image_style:
                style_parts.append(image_style)

            # Store height and aspect ratio
            style_parts.append(f"--breakpoint-{idx}-height: {bp_height}px;")
            style_parts.append(f"--breakpoint-{idx}-ar: {bp_width} / {bp_height};")

            # Update last_image for fallback chain
            if bp.get("image"):
                last_image = bp.get("image")

        # Generate dynamic CSS for media queries
        css_parts = []
        if breakpoint_dicts:
            # Base styles (first/smallest breakpoint)
            first_bp = breakpoint_dicts[0]
            first_width = first_bp.get("width", 640)
            first_height = first_bp.get("height", 80)
            
            css_parts.append(f"""
        .widget-type-header {{
            width: 100%;
            background-image: var(--breakpoint-0-bg-image);
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
            height: {first_height}px;
            aspect-ratio: var(--breakpoint-0-ar, {first_width} / {first_height});
        }}""")

            # Media queries for subsequent breakpoints
            for idx in range(1, len(breakpoint_dicts)):
                bp = breakpoint_dicts[idx]
                bp_width = bp.get("width", 640)
                bp_height = bp.get("height", 80)
                
                css_parts.append(f"""
        @media (min-width: {bp_width}px) {{
            .widget-type-header {{
                background-image: var(--breakpoint-{idx}-bg-image);
                height: {bp_height}px;
                aspect-ratio: auto;
                background-size: auto 100%;
                background-position: top left;
            }}
        }}""")

        # Store generated CSS in template config
        template_config["header_css"] = "".join(css_parts)
        
        # Join all style parts for inline styles
        template_config["header_style"] = " ".join(style_parts) if style_parts else ""

        return template_config
