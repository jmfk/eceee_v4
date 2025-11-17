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
        description="Banner mode: header (H2 text-only) or text (rich text)",
        json_schema_extra={
            "component": "SelectInput",
            "options": [
                {"label": "Header Mode", "value": "header"},
                {"label": "Text Mode", "value": "text"},
            ],
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
    textPosition: Literal["left", "right"] = Field(
        "left",
        description="Position of text block relative to images",
        json_schema_extra={
            "component": "SelectInput",
            "options": [
                {"label": "Left", "value": "left"},
                {"label": "Right", "value": "right"},
            ],
            "order": 4,
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
            "order": 5,
            "group": "Layout",
        },
    )
    image1: Optional[str] = Field(
        None,
        description="First image URL",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 6,
            "group": "Images",
        },
    )
    image2: Optional[str] = Field(
        None,
        description="Second image URL (for 2 or 4 image layouts)",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 7,
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
            "order": 8,
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
            "order": 9,
            "group": "Images",
            "conditionalOn": {"imageCount": [4]},
        },
    )
    componentStyle: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 10,
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
                "minHeight",
                "maxHeight",
                "padding",
                "margin",
                "position",
                "display",
                "flexDirection",
                "justifyContent",
                "alignItems",
            ],
        },
        "banner-background": {
            "label": "Background image area",
            "properties": [
                "width",
                "height",
                "position",
                "top",
                "left",
                "objectFit",
                "objectPosition",
                "opacity",
                "zIndex",
            ],
        },
        "banner-body": {
            "label": "Banner body (text + images container)",
            "properties": [
                "display",
                "flex",
                "minHeight",
                "flexDirection",
                "position",
                "zIndex",
            ],
        },
        "banner-images": {
            "label": "Foreground images container",
            "properties": [
                "gap",
                "width",
            ],
        },
        "banner-image": {
            "label": "Individual Image",
            "properties": [
                "height",
            ],
        },
        "banner-text": {
            "label": "Text content area",
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
                "color",
                "textAlign",
                "maxWidth",
                "borderRadius",
                "boxShadow",
                "position",
                "zIndex",
            ],
        },
    }

    widget_css = """
    .banner-widget {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
        border-radius: 0;
        box-shadow: none;
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
        position: relative;
        z-index: 1;
        display: flex;
        flex: 1;
        min-height: 0;
    }
    
    .banner-text {
        padding: 0;
        font-size: 12px;
        line-height: 1.6;
        overflow-y: auto;
    }
    
    .banner-images {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
    }
    
    .banner-images.layout-1 {
        flex: 1;
    }
    
    .banner-images.layout-2 {
        flex: 1;
    }
    
  
    /* Individual image styling - height can be controlled via layout properties */
    .banner-image {
        width: 400px;
        height: 400px;  /* Default height, can be overridden via layout properties */
        object-fit: cover;
    }
    
    /* Text positioning */
    .banner-body.text-left .banner-text {
        order: 1;
    }
    
    .banner-body.text-left .banner-images {
        order: 2;
    }
    
    .banner-body.text-right .banner-text {
        order: 2;
    }
    
    .banner-body.text-right .banner-images {
        order: 1;
    }
    
    /* Width ratios for text/image splits */
    .banner-body.image-count-1 .banner-text {
        flex: 2;
    }
    
    .banner-body.image-count-1 .banner-images {
        flex: 1;
    }
    
    .banner-body.image-count-2 .banner-text {
        flex: 1;
    }
    
    .banner-body.image-count-2 .banner-images {
        flex: 1;
    }
    
    /* Responsive behavior */
    @media (max-width: 768px) {
        .banner-body {
            flex-direction: column;
        }
        
        .banner-body.text-left .banner-text,
        .banner-body.text-right .banner-text {
            order: 1;
        }
        
        .banner-body.text-left .banner-images,
        .banner-body.text-right .banner-images {
            order: 2;
        }
        
        .banner-images.layout-2,
        .banner-images.layout-4 {
            flex-wrap: wrap;
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

        # Prepare context with all widget data
        context = prepare_component_context(
            content=config.get("content", ""),
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Add banner specific context
        context["bannerMode"] = config.get("banner_mode") or config.get(
            "bannerMode", "text"
        )
        context["textPosition"] = config.get("text_position") or config.get(
            "textPosition", "left"
        )
        context["imageCount"] = config.get("image_count") or config.get("imageCount", 1)
        context["backgroundImage"] = config.get("background_image") or config.get(
            "backgroundImage"
        )

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
        Prepare template context with snake_case field conversions and layout properties.
        """
        template_config = config.copy() if config else {}

        # Ensure snake_case fields for template
        template_config["banner_mode"] = config.get("bannerMode") or config.get(
            "banner_mode", "text"
        )
        template_config["text_position"] = config.get("textPosition") or config.get(
            "text_position", "left"
        )
        template_config["image_count"] = config.get("imageCount") or config.get(
            "image_count", 1
        )
        template_config["component_style"] = config.get("componentStyle") or config.get(
            "component_style", "default"
        )
        template_config["background_image"] = config.get(
            "backgroundImage"
        ) or config.get("background_image")

        # Convert image fields from camelCase to snake_case for template
        template_config["image_1"] = config.get("image1") or config.get("image_1")
        template_config["image_2"] = config.get("image2") or config.get("image_2")
        template_config["image_3"] = config.get("image3") or config.get("image_3")
        template_config["image_4"] = config.get("image4") or config.get("image_4")

        # Extract layout properties from theme for dynamic image sizing
        theme = context.get("theme") if context else None
        if theme and hasattr(theme, "design_groups"):
            design_groups = theme.design_groups or {}
            groups = design_groups.get("groups", [])

            # Find layout properties for banner-image part
            for group in groups:
                layout_props = group.get("layoutProperties") or group.get(
                    "layout_properties", {}
                )
                if "banner-image" in layout_props:
                    # Extract height from breakpoints (use 'sm' as default)
                    part_props = layout_props["banner-image"]
                    height_val = part_props.get("sm", {}).get("height")

                    # Parse height and calculate width (1:1 ratio)
                    if height_val:
                        try:
                            # Remove 'px' suffix if present
                            height_str = str(height_val).replace("px", "").strip()
                            height_px = int(height_str)

                            # Set image dimensions for different layouts (1:1 aspect ratio)
                            template_config["image_width"] = height_px
                            template_config["image_height"] = height_px

                            # Retina (2x) dimensions
                            template_config["image_width_2x"] = height_px * 2
                            template_config["image_height_2x"] = height_px * 2
                        except (ValueError, AttributeError):
                            # If parsing fails, defaults will be used from template
                            logger.warning(
                                f"Could not parse height value: {height_val}"
                            )
                    break  # Use first matching group

        return template_config
