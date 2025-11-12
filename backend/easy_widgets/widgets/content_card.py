"""
Content Card widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

logger = logging.getLogger(__name__)


class ImageMediaItem(BaseModel):
    """Individual media item for Content Card widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: Optional[str] = Field(None, description="Media file ID")
    url: str = Field(..., description="Media URL (image or video)")
    type: Literal["image", "video"] = Field("image", description="Media type")
    altText: str = Field(
        ..., min_length=1, description="Alternative text for accessibility"
    )
    caption: Optional[str] = Field(None, description="Optional caption")
    title: Optional[str] = Field(None, description="Image title")
    photographer: Optional[str] = Field(None, description="Photographer or source")
    source: Optional[str] = Field(None, description="Image source")
    thumbnailUrl: Optional[str] = Field(None, description="Thumbnail URL for videos")
    width: Optional[int] = Field(None, description="Image width")
    height: Optional[int] = Field(None, description="Image height")


class ContentCardConfig(BaseModel):
    """Configuration for Content Card widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
        },
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
    mediaItems: List[ImageMediaItem] = Field(
        default_factory=list,
        description="List of images to display",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
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


@register_widget_type
class ContentCardWidget(BaseWidget):
    """Content card widget with flexible header, text, and image layouts"""

    name = "Content Card"
    description = "Flexible content card with header, text, and configurable image layouts"
    template_name = "easy_widgets/widgets/content_card.html"

    widget_css = """
    .content-card-widget {
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
        background: var(--card-bg, #ffffff);
        border-radius: var(--card-radius, 0.5rem);
        box-shadow: var(--card-shadow, 0 1px 3px rgba(0, 0, 0, 0.1));
    }
    
    .content-card-header {
        padding: var(--header-padding, 1.5rem 1.5rem 1rem);
        font-size: var(--header-font-size, 1.5rem);
        font-weight: var(--header-font-weight, 600);
        color: var(--header-color, #111827);
        line-height: var(--header-line-height, 1.3);
        border-bottom: var(--header-border, 1px solid #e5e7eb);
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
        "card-radius": "0.5rem",
        "card-shadow": "0 1px 3px rgba(0, 0, 0, 0.1)",
        "header-padding": "1.5rem 1.5rem 1rem",
        "header-font-size": "1.5rem",
        "header-font-weight": "600",
        "header-color": "#111827",
        "header-line-height": "1.3",
        "header-border": "1px solid #e5e7eb",
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
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        template = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template.strip() == "{{passthru}}":
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
        context["textPosition"] = config.get("text_position") or config.get("textPosition", "left")
        context["imageCount"] = config.get("image_count") or config.get("imageCount", 1)
        
        # Convert media items from camelCase to snake_case if needed
        media_items = config.get("media_items") or config.get("mediaItems", [])
        context["mediaItems"] = media_items

        # Render template
        html = render_mustache(template, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions.
        """
        template_config = config.copy() if config else {}
        
        # Ensure snake_case fields for template
        template_config["text_position"] = config.get("textPosition") or config.get("text_position", "left")
        template_config["image_count"] = config.get("imageCount") or config.get("image_count", 1)
        template_config["component_style"] = config.get("componentStyle") or config.get("component_style", "default")
        
        # Convert media items from camelCase to snake_case for template
        media_items = config.get("mediaItems") or config.get("media_items", [])
        snake_case_items = []
        for item in media_items:
            if isinstance(item, dict):
                snake_case_item = {
                    "id": item.get("id"),
                    "url": item.get("url"),
                    "type": item.get("type", "image"),
                    "alt_text": item.get("altText", ""),
                    "caption": item.get("caption", ""),
                    "title": item.get("title", ""),
                    "photographer": item.get("photographer", ""),
                    "source": item.get("source", ""),
                    "width": item.get("width"),
                    "height": item.get("height"),
                    "thumbnail_url": item.get("thumbnailUrl"),
                }
                snake_case_items.append(snake_case_item)
            else:
                snake_case_items.append(item)
        
        template_config["media_items"] = snake_case_items
        
        return template_config

