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
    textPosition: Literal["left", "right"] = Field(
        "left",
        description="Position of text block relative to images",
        json_schema_extra={
            "component": "SelectInput",
            "options": [
                {"label": "Left", "value": "left"},
                {"label": "Right", "value": "right"},
            ],
            "order": 3,
            "group": "Layout",
        },
    )
    imageCount: Literal[1, 2, 4] = Field(
        1,
        description="Number of images to display",
        json_schema_extra={
            "component": "SelectInput",
            "options": [
                {"label": "1 Image", "value": 1},
                {"label": "2 Images", "value": 2},
                {"label": "4 Images (no text)", "value": 4},
            ],
            "order": 4,
            "group": "Layout",
        },
    )
    image1: Optional[str] = Field(
        None,
        description="First image URL",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 5,
            "group": "Images",
        },
    )
    image2: Optional[str] = Field(
        None,
        description="Second image URL (for 2 or 4 image layouts)",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 6,
            "group": "Images",
            "conditionalOn": {"imageCount": [2, 4]},
        },
    )
    image3: Optional[str] = Field(
        None,
        description="Third image URL (for 4 image layout)",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 7,
            "group": "Images",
            "conditionalOn": {"imageCount": [4]},
        },
    )
    image4: Optional[str] = Field(
        None,
        description="Fourth image URL (for 4 image layout)",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 8,
            "group": "Images",
            "conditionalOn": {"imageCount": [4]},
        },
    )
    componentStyle: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 9,
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

    widget_css = """
    .content-card-widget {
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
        background: var(--card-bg, #ffffff);
        border-radius: var(--card-radius, 0);
        box-shadow: var(--card-shadow, none);
    }
    
    .content-card-header {
        padding: var(--header-padding, 1.5rem 1.5rem 1rem);
        font-size: var(--header-font-size, 1.5rem);
        font-weight: var(--header-font-weight, 600);
        color: var(--header-color, #111827);
        line-height: var(--header-line-height, 1.3);
        border-bottom: var(--header-border, none);
    }
    
    .content-card-body {
        display: flex;
        flex: 1;
        min-height: 0;
    }
    
    .content-card-text {
        padding: var(--text-padding, 1.5rem);
        font-size: var(--text-font-size, 1rem);
        line-height: var(--text-line-height, 1.6);
        color: var(--text-color, #374151);
        overflow-y: auto;
    }
    
    .content-card-images {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--images-bg, #f9fafb);
    }
    
    .content-card-images.layout-1 {
        flex: 1;
    }
    
    .content-card-images.layout-2 {
        flex: 1;
        gap: var(--images-gap, 0.5rem);
    }
    
    .content-card-images.layout-4 {
        width: 100%;
        gap: var(--images-gap, 0.5rem);
    }
    
    .content-card-images img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .content-card-images.layout-1 img {
        max-width: 100%;
        max-height: 100%;
    }
    
    .content-card-images.layout-2 img {
        flex: 1;
        max-width: 50%;
    }
    
    .content-card-images.layout-4 img {
        flex: 1;
        max-width: 25%;
    }
    
    /* Text positioning */
    .content-card-body.text-left .content-card-text {
        order: 1;
    }
    
    .content-card-body.text-left .content-card-images {
        order: 2;
    }
    
    .content-card-body.text-right .content-card-text {
        order: 2;
    }
    
    .content-card-body.text-right .content-card-images {
        order: 1;
    }
    
    /* Width ratios for text/image splits */
    .content-card-body.image-count-1 .content-card-text {
        flex: 2;
    }
    
    .content-card-body.image-count-1 .content-card-images {
        flex: 1;
    }
    
    .content-card-body.image-count-2 .content-card-text {
        flex: 1;
    }
    
    .content-card-body.image-count-2 .content-card-images {
        flex: 1;
    }
    
    /* Responsive behavior */
    @media (max-width: 768px) {
        .content-card-body {
            flex-direction: column;
        }
        
        .content-card-body.text-left .content-card-text,
        .content-card-body.text-right .content-card-text {
            order: 1;
        }
        
        .content-card-body.text-left .content-card-images,
        .content-card-body.text-right .content-card-images {
            order: 2;
        }
        
        .content-card-images.layout-2,
        .content-card-images.layout-4 {
            flex-wrap: wrap;
        }
        
        .content-card-images.layout-2 img {
            max-width: 100%;
        }
        
        .content-card-images.layout-4 img {
            max-width: 50%;
        }
    }
    """

    css_variables = {
        "card-bg": "#ffffff",
        "card-radius": "0",
        "card-shadow": "none",
        "header-padding": "1.5rem 1.5rem 1rem",
        "header-font-size": "1.5rem",
        "header-font-weight": "600",
        "header-color": "#111827",
        "header-line-height": "1.3",
        "header-border": "none",
        "text-padding": "1.5rem",
        "text-font-size": "1rem",
        "text-line-height": "1.6",
        "text-color": "#374151",
        "images-bg": "#f9fafb",
        "images-gap": "0.5rem",
    }

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
        context["textPosition"] = config.get("text_position") or config.get(
            "textPosition", "left"
        )
        context["imageCount"] = config.get("image_count") or config.get("imageCount", 1)

        # Add image URLs
        context["image1"] = config.get("image1") or config.get("image_1")
        context["image2"] = config.get("image2") or config.get("image_2")
        context["image3"] = config.get("image3") or config.get("image_3")
        context["image4"] = config.get("image4") or config.get("image_4")

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions.
        """
        template_config = config.copy() if config else {}

        # Ensure snake_case fields for template
        template_config["text_position"] = config.get("textPosition") or config.get(
            "text_position", "left"
        )
        template_config["image_count"] = config.get("imageCount") or config.get(
            "image_count", 1
        )
        template_config["component_style"] = config.get("componentStyle") or config.get(
            "component_style", "default"
        )

        # Convert image fields from camelCase to snake_case for template
        template_config["image_1"] = config.get("image1") or config.get("image_1")
        template_config["image_2"] = config.get("image2") or config.get("image_2")
        template_config["image_3"] = config.get("image3") or config.get("image_3")
        template_config["image_4"] = config.get("image4") or config.get("image_4")

        return template_config
