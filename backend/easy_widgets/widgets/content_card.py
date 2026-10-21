"""
Content Card widget implementation.
"""

import logging
from typing import Literal, Optional, Type

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget

logger = logging.getLogger(__name__)


class ContentCardConfig(BaseModel):
    """Configuration for Content Card widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    header: str = Field(
        "",
        description="Header text (supports line breaks)",
        json_schema_extra={
            "hidden": True,
            "component": "TextareaInput",
            "placeholder": "Enter header text...",
            "rows": 2,
            "order": 1,
            "group": "Content",
        },
    )
    content: str = Field(
        "",
        description="Rich text content for the text block",
        json_schema_extra={
            "hidden": True,
            "component": "RichTextInput",
            "rows": 6,
            "order": 2,
            "group": "Content",
        },
    )
    imageSize: Literal["square", "rectangle"] = Field(
        "square",
        description="Size/shape of the image",
        json_schema_extra={
            "editorPrimary": True,
            "component": "ImageSizeSelector",
            "order": 3,
            "group": "Layout",
        },
    )
    image1: Optional[dict] = Field(
        None,
        description="MediaFile object for image",
        json_schema_extra={
            "editorPrimary": True,
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 4,
            "group": "Images",
        },
    )
    componentStyle: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 5,
            "group": "Styling",
        },
    )
    showBorder: bool = Field(
        True,
        description="Show widget border",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 6,
            "group": "Styling",
        },
    )
    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
            "order": 9999,
            "group": "Advanced",
        },
    )
    anchor_title: str = Field(
        "",
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Auto-generated from header",
            "helpText": "Displayed in navigation menus when linking to this content",
            "order": 10000,
            "group": "Advanced",
        },
    )


@register_widget_type
@catalog_widget
class ContentCardWidget(BaseWidget):
    """Content card widget with flexible header, text, and image layouts"""

    description = "Flexible content card with header, text, and configurable image layouts"
    template_name = "easy_widgets/widgets/content_card.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ContentCardConfig

    def render_with_style(self, config, theme):
        """
        Render content card with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) - always renders using template
        """
        from webpages.utils.mustache_renderer import (
            prepare_component_context,
            render_mustache,
        )

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

        # Prepare context with all widget data
        context = prepare_component_context(
            content=config.get("content", ""),
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Add content card specific context
        context["header"] = config.get("header", "")
        context["imageSize"] = config.get("image_size") or config.get("imageSize", "square")

        # Add image URL
        context["image1"] = config.get("image1") or config.get("image_1")

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions and layout properties.
        """
        template_config = config.copy() if config else {}

        # Ensure snake_case fields for template
        template_config["image_size"] = config.get("imageSize", config.get("image_size", "square"))
        template_config["component_style"] = config.get("component_style", "default")
        template_config["show_border"] = config.get("show_border", True)

        # Handle image1 (now a dict MediaFile object)
        image1 = config.get("image1")
        if image1 and isinstance(image1, dict):
            # Extract URL from MediaFile object
            image_url = image1.get("imgproxy_base_url") or image1.get("file_url")
            template_config["image1_url"] = image_url
        else:
            template_config["image1_url"] = None
        template_config["image_1"] = image1
        template_config["image1"] = image1

        # Resolve link objects in content HTML (similar to ContentWidget)
        request = context.get("request") if context else None

        header_html = config.get("header", "")
        if header_html:
            from webpages.services.link_resolver import resolve_links_in_html

            template_config["header"] = resolve_links_in_html(header_html, request)

        content_html = config.get("content", "")
        if content_html:
            from bs4 import BeautifulSoup

            from webpages.services.link_resolver import resolve_links_in_html

            soup = BeautifulSoup(content_html, "html.parser")
            content_str = str(soup)
            resolved_content = resolve_links_in_html(content_str, request)
            if resolved_content != content_str:
                template_config["content"] = resolved_content
                template_config["processed_content"] = resolved_content

        return template_config
