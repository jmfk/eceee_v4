"""
Content Card widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

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
            "component": "ImageSizeSelector",
            "order": 3,
            "group": "Layout",
        },
    )
    image1: Optional[str] = Field(
        None,
        description="Image URL",
        json_schema_extra={
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
class ContentCardWidget(BaseWidget):
    """Content card widget with flexible header, text, and image layouts"""

    name = "Content Card"
    description = (
        "Flexible content card with header, text, and configurable image layouts"
    )
    template_name = "easy_widgets/widgets/content_card.html"

    layout_parts = {
        "content-card-widget": {
            "label": "Content Card Widget",
            "properties": [
                "width",
                "height",
                "padding",
                "backgroundColor",
                "borderColor",
                "borderWidth",
            ],
        },
        "content-card-header": {
            "label": "Card Header",
            "properties": [
                "width",
                "height",
                "padding",
                "fontFamily",
                "fontSize",
                "fontWeight",
                "color",
                "lineHeight",
                "borderBottom",
            ],
        },
        "content-card-text": {
            "label": "Text Content",
            "properties": [
                "width",
                "height",
                "padding",
                "fontFamily",
                "fontSize",
                "fontWeight",
                "color",
                "lineHeight",
            ],
        },
        "content-card-image": {
            "label": "Individual Image",
            "properties": [
                "width",
                "height",
            ],
        },
    }

    widget_css = """
    .content-card-widget {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 310px;
        outline: 1px solid rgb(0,0,0,0.3);
        border-width: 0;
        overflow: hidden;
        border-radius: 0;
        box-shadow: none;
        margin-bottom: 30px;
    }
    .content-card-widget.border-disabled {
        outline: none;
    }
    .content-card-widget:last-child {
        margin-bottom: 0;
    }

    .content-card-header {
        box-sizing: border-box;
        height: 140px;
        padding: 30px;
        font-size: 36px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 400;
    }
    .content-card-body {
        display: flex;  
        flex: 1;
        min-height: 0;
        height: 170px;
        padding-bottom: 30px;
        gap: 30px;
    }
    .content-card-text {
        flex: 1; 
        padding: 0px 0px 0px 30px;
        font-size: 16px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 300;
        line-height: 22px;
        overflow: hidden;
    }
    .content-card-images {
        display: flex;
        align-items: top;
        justify-content: right;
        padding: 0px 30px 30px 0px;        
    }
    
    /* Individual image styling - square (default) */
    .content-card-image {
        width: 140px;
        height: 140px;
        object-fit: cover;
    }
    
    /* Rectangle image styling */
    .content-card-body.image-size-rectangle .content-card-image {
        width: 280px;
        height: 140px;
    }
     
    /* Responsive behavior */
    @media (max-width: 768px) {
        .content-card-body {
            flex-direction: column;
        }
    }
    """

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
            render_mustache,
            prepare_component_context,
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
        context["imageSize"] = config.get("image_size") or config.get(
            "imageSize", "square"
        )

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
        template_config["image_size"] = config.get("image_size", "square")
        template_config["component_style"] = config.get("component_style", "default")
        template_config["show_border"] = config.get("show_border", True)

        # Get image field for template
        template_config["image_1"] = config.get("image_1")

        return template_config
