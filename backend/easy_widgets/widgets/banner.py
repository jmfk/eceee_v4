"""
Banner widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

logger = logging.getLogger(__name__)


class BannerConfig(BaseModel):
    """Configuration for Banner widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    bannerMode: Literal["header", "text"] = Field(
        "text",
        description="Banner mode: header (H2 centered) or text (H3 + paragraph with optional image)",
        json_schema_extra={
            "component": "BannerModeSelector",
            "order": 1,
            "group": "Content",
        },
    )
    headerContent: str = Field(
        "",
        description="Header text content (plain text, shown when in header mode)",
        json_schema_extra={
            "component": "RichTextInput",
            "rows": 3,
            "order": 2,
            "group": "Content",
            "conditionalOn": {"bannerMode": ["header"]},
        },
    )
    textContent: str = Field(
        "",
        description="Rich text content (shown when in text mode)",
        json_schema_extra={
            "component": "RichTextInput",
            "rows": 6,
            "order": 3,
            "group": "Content",
            "conditionalOn": {"bannerMode": ["text"]},
        },
    )
    imageSize: Literal["square", "rectangle"] = Field(
        "square",
        description="Size/shape of the image",
        json_schema_extra={
            "component": "ImageSizeSelector",
            "order": 4,
            "group": "Layout",
            "conditionalOn": {"bannerMode": ["text"]},
        },
    )
    image1: Optional[str] = Field(
        None,
        description="Image URL",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 5,
            "group": "Images",
            "conditionalOn": {"bannerMode": ["text"]},
        },
    )
    backgroundImage: Optional[str] = Field(
        None,
        description="Background image (cover)",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 3,
            "group": "Content",
        },
    )

    text_color: str = Field(
        "#000000",
        description="Text color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 4,
            "group": "Styling",
        },
    )

    background_color: str = Field(
        "#ffffff",
        description="Background color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 5,
            "group": "Styling",
        },
    )

    componentStyle: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 6,
            "group": "Styling",
        },
    )
    showBorder: bool = Field(
        True,
        description="Show widget border",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 7,
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
            "placeholder": "Auto-generated from content",
            "helpText": "Displayed in navigation menus when linking to this content",
            "order": 10000,
            "group": "Advanced",
        },
    )


@register_widget_type
class BannerWidget(BaseWidget):
    """Banner widget with flexible text and image layouts"""

    name = "Banner"
    description = "Flexible banner with text content and configurable image layouts"
    template_name = "easy_widgets/widgets/banner.html"

    layout_parts = {
        "banner-widget": {
            "label": "Main widget container",
            "properties": [
                "width",
                "height",
            ],
        },
        "banner-image": {
            "label": "Individual Image",
            "properties": [
                "width",
                "height",
            ],
        },
    }

    widget_css = """
    .banner-widget {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 140px;
        outline: 1px solid rgb(0,0,0,0.3);
        border-width: 0;
        overflow: hidden;
        border-radius: 0;
        box-shadow: none;
        margin-bottom: 30px;
        position: relative;
    }
    .banner-widget.border-disabled {
        outline: none;
    }
    .banner-widget:last-child {
        margin-bottom: 0;
    }
    .banner-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 0;
    }
    
    .banner-body {
        display: flex;  
        flex: 1;
        min-height: 0;
        height: 140px;
        position: relative;
        z-index: 1;
    }
    
    /* Text mode styles */
    .banner-body.mode-text {
        justify-content: flex-start;
        align-items: flex-start;
    }
    
    .banner-body.mode-text .banner-text {
        flex: 1; 
        padding: 30px;
        font-size: 16px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 300;
        line-height: 22px;
        overflow: hidden;
    }
    
    .banner-body.mode-text .banner-images {
        display: flex;
        align-items: top;
        justify-content: right;
        padding: 0px; 
    }
    
    /* Header mode styles */
    .banner-body.mode-header {
        justify-content: center;
        align-items: center;
    }
    
    .banner-body.mode-header .banner-text {
        width: 100%;
        padding: 30px;
        text-align: center;
        font-size: 36px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 500;
        line-height: 32px;
        overflow: hidden;
        margin-top: 0;
        margin-bottom: 0;
    }
    .banner-body.mode-text .banner-text h3 {
        font-size: 18px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 700;
        line-height: 22px;
        overflow: hidden;
        margin-top: 0;
        margin-bottom: 0;
    }
    .banner-body.mode-text .banner-text p {
        font-size: 14px;
        font-family: 'Source Sans 3', sans-serif;
        font-weight: 300;
        line-height: 17px;
        overflow: hidden;
        margin-top: 0;
        margin-bottom: 0;
    }
    /* Individual image styling - square (default) */
    .banner-image {
        width: 140px;
        height: 140px;
        object-fit: cover;
        border: 5px solid white;
    }

    .banner-widget.border-disabled {
        border: none;
    }
    
    /* Rectangle image styling */
    .banner-body.image-size-rectangle .banner-image {
        width: 280px;
        height: 140px;
        border: 5px solid white;
    }
    
    /* Responsive behavior */
    @media (max-width: 768px) {
        .banner-body.mode-text {
            flex-direction: column;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return BannerConfig

    def render_with_style(self, config, theme):
        """
        Render banner with custom component style from theme.

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

        # Get banner mode
        banner_mode = config.get("banner_mode") or config.get("bannerMode", "text")

        # Select content based on mode
        content = (
            config.get("header_content") or config.get("headerContent", "")
            if banner_mode == "header"
            else config.get("text_content") or config.get("textContent", "")
        )

        # Prepare context with all widget data
        context = prepare_component_context(
            content=content,
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Add banner specific context
        context["bannerMode"] = banner_mode
        context["headerContent"] = config.get("header_content") or config.get(
            "headerContent", ""
        )
        context["textContent"] = config.get("text_content") or config.get(
            "textContent", ""
        )
        context["imageSize"] = config.get("image_size") or config.get(
            "imageSize", "square"
        )
        context["backgroundImage"] = config.get("background_image") or config.get(
            "backgroundImage"
        )

        # Add image URL (only for text mode)
        context["image1"] = config.get("image1") or config.get("image_1")

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions and layout properties.
        """
        template_config = config.copy() if config else {}

        # Build inline styles for colors (direct application)
        style_parts = []

        text_color = config.get("text_color", "#000000")
        background_color = config.get("background_color", "#ffffff")

        style_parts.append(f"background-color: {background_color};")
        style_parts.append(f"color: {text_color};")

        # Join all style parts
        template_config["banner_style"] = " ".join(style_parts)

        # Ensure snake_case fields for template
        template_config["banner_mode"] = config.get("bannerMode") or config.get(
            "banner_mode", "text"
        )
        template_config["header_content"] = config.get("headerContent") or config.get(
            "header_content", ""
        )
        template_config["text_content"] = config.get("textContent") or config.get(
            "text_content", ""
        )
        template_config["image_size"] = config.get("imageSize") or config.get(
            "image_size", "square"
        )
        template_config["component_style"] = config.get("componentStyle") or config.get(
            "component_style", "default"
        )
        template_config["show_border"] = (
            config.get("showBorder")
            if config.get("showBorder") is not None
            else config.get("show_border", True)
        )
        template_config["background_image"] = config.get(
            "backgroundImage"
        ) or config.get("background_image")

        # Convert image field from camelCase to snake_case for template (only for text mode)
        template_config["image_1"] = config.get("image1") or config.get("image_1")

        return template_config
