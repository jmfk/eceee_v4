"""
Footer widget implementation.
"""

from typing import Type, Optional, Literal, Dict, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class FooterConfig(BaseModel):
    """Configuration for Footer widget with single content slot"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    background_color: Optional[str] = Field(
        None,
        description="Background color (hex or CSS color)",
        json_schema_extra={
            "component": "ColorInput",
            "order": 1,
            "group": "Styling",
        },
    )
    background_image: Optional[str] = Field(
        None,
        description="Background image URL",
        json_schema_extra={
            "component": "ImageInput",
            "order": 2,
            "mediaTypes": ["image"],
            "group": "Styling",
        },
    )
    text_color: Optional[str] = Field(
        None,
        description="Text color (hex or CSS color)",
        json_schema_extra={
            "component": "ColorInput",
            "order": 3,
            "group": "Styling",
        },
    )
    slots: Dict[str, List] = Field(
        default_factory=lambda: {"content": []},
        description="Widget slots (content slot for footer widgets)",
        json_schema_extra={
            "hidden": True,  # Hidden from form - managed by SlotEditor
        },
    )


@register_widget_type
class FooterWidget(BaseWidget):
    """Footer widget with single content slot and background styling"""

    app_label = "easy_widgets"
    name = "Footer"
    description = "Footer container with content slot and background styling options"
    template_name = "easy_widgets/widgets/footer.html"

    layout_parts = {
        "footer-widget": {
            "label": "Footer widget container",
            "properties": [
                "width",
                "height",
                "backgroundColor",
                "backgroundImage",
            ],
        },
    }

    widget_css = """
    .footer-widget {
        box-sizing: border-box;
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    
    .empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        font-size: 16px;
        font-weight: 300;
        padding: 30px;
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig

    def render_with_style(self, config, theme):
        """
        Render footer with custom component style from theme.

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

        # For default style, return None to use standard Django template rendering
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)

        # If style not found in theme, fall back to default rendering
        if not style:
            return None

        template_str = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template_str.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the footer HTML using the default template first
        footer_html = render_to_string(
            self.template_name, {"config": prepared_config, "widget_type": self}
        )

        # Prepare context with rendered footer as content
        context = prepare_component_context(
            content=footer_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def render(self, config, context=None):
        """Override render to skip rendering if footer is empty"""
        # Get slots data
        slots_data = config.get("slots", {"content": []})
        content_widgets = slots_data.get("content", [])

        # If no content widgets, don't render the footer at all
        if not content_widgets or len(content_widgets) == 0:
            return ""

        # Otherwise, use default rendering
        return super().render(config, context)

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering and background image processing"""
        from file_manager.imgproxy import imgproxy_service

        template_config = super().prepare_template_context(config, context)

        # Process background image if provided
        background_image = config.get("background_image")
        if background_image and isinstance(background_image, dict):
            imgproxy_base_url = background_image.get("imgproxy_base_url")
            if imgproxy_base_url:
                # Generate responsive image URL for footer
                image_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=1920,
                    height=400,
                    resize_type="fill",
                )
                if image_url:
                    template_config["background_image"] = image_url

        # Get slots data (single 'content' slot)
        slots_data = config.get("slots", {"content": []})

        # Render widgets for the content slot using existing renderer
        rendered_slots = {}
        if context and "renderer" in context:
            content_widgets = slots_data.get("content", [])
            rendered_widgets = []
            for index, widget_data in enumerate(content_widgets):
                try:
                    # Filter out hidden widgets
                    widget_config = widget_data.get("config", {})
                    is_visible = widget_config.get(
                        "isVisible", widget_config.get("is_visible", True)
                    )
                    if not is_visible:
                        continue

                    # Filter out inactive widgets
                    is_active = widget_config.get(
                        "isActive", widget_config.get("is_active", True)
                    )
                    if not is_active:
                        continue

                    # Add sort_order if missing
                    if "sort_order" not in widget_data and "order" not in widget_data:
                        widget_data = {**widget_data, "sort_order": index}

                    widget_html = context["renderer"].render_widget_json(
                        widget_data, context
                    )
                    rendered_widgets.append(
                        {"html": widget_html, "widget_data": widget_data}
                    )
                except Exception as e:
                    continue
            rendered_slots["content"] = rendered_widgets
        else:
            # Fallback: provide raw widget data
            rendered_slots = {
                "content": [
                    {"html": None, "widget_data": widget}
                    for widget in slots_data.get("content", [])
                ]
            }

        template_config.update(
            {"slots_data": slots_data, "rendered_slots": rendered_slots}
        )

        return template_config
