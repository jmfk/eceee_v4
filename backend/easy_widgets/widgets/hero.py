"""
Hero widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class HeroConfig(BaseModel):
    """Configuration for Hero widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    header: str = Field(
        ...,
        min_length=1,
        description="Main header text (H1)",
        json_schema_extra={
            "component": "TextInput",
            "order": 1,
            "placeholder": "Enter hero header",
        },
    )

    before_text: Optional[str] = Field(
        None,
        description="Text displayed before the header",
        json_schema_extra={
            "component": "TextareaInput",
            "order": 2,
            "placeholder": "Optional text before header",
            "rows": 3,
        },
    )

    after_text: Optional[str] = Field(
        None,
        description="Text displayed after the header",
        json_schema_extra={
            "component": "TextareaInput",
            "order": 3,
            "placeholder": "Optional text after header",
            "rows": 3,
        },
    )

    image: Optional[dict] = Field(
        None,
        description="MediaFile object for background or featured image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 4,
            "mediaTypes": ["image"],
            "allowCollections": False,
            "multiple": False,
        },
    )

    text_color: str = Field(
        "#ffffff",
        description="Text color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 5,
            "group": "colors",
        },
    )

    decor_color: str = Field(
        "#cccccc",
        description="Decorative elements color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 6,
            "group": "colors",
        },
    )

    background_color: str = Field(
        "#000000",
        description="Background color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 7,
            "group": "colors",
        },
    )

    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 8,
        },
    )


@register_widget_type
class HeroWidget(BaseWidget):
    """Hero widget with header, optional before/after text, image, and color customization"""

    name = "Hero"
    description = "Hero section with header text, optional before/after text, image, and customizable colors"
    template_name = "easy_widgets/widgets/hero.html"

    layout_parts = {
        "hero-widget": {
            "label": "Main hero container",
            "properties": [
                "width",
                "height",
                "minHeight",
                "padding",
                "margin",
                "backgroundColor",
                "color",
            ],
        },
        "hero-content": {
            "label": "Text content overlay",
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
                "color",
                "textAlign",
                "maxWidth",
            ],
        },
        "hero-header": {
            "label": "Hero header (h1)",
            "properties": [
                "fontFamily",
                "fontSize",
                "fontWeight",
                "lineHeight",
                "color",
                "margin",
            ],
        },
        "hero-before-text": {
            "label": "Before text (h5)",
            "properties": [
                "fontFamily",
                "fontSize",
                "fontWeight",
                "lineHeight",
                "color",
                "margin",
            ],
        },
        "hero-after-text": {
            "label": "After text (h6)",
            "properties": [
                "fontFamily",
                "fontSize",
                "fontWeight",
                "lineHeight",
                "color",
                "margin",
            ],
        },
    }

    widget_css = """
    .hero-widget {
        box-sizing: border-box;
        position: relative;
        padding: 0;
        overflow: hidden;
        height: 310px;
        min-height: 310px;
        max-height: 310px;
        width: 100%;
        background-color: var(--hero-bg-color, #000000);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        color: var(--hero-text-color, #ffffff);
        margin-bottom: 30px;
        flex-shrink: 0;
    }
    .hero-widget:last-child {
        margin-bottom: 0;
    }   
    
    .hero-content {
        position: relative;
        max-width: 1200px;
        margin: 0 auto;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 100%;
        padding: 30px;
    }

    .hero-widget h1 {
        font-family: "Source Sans 3", sans-serif;
        font-weight: 300;
        font-size: 54px;
        line-height: 44px;
        margin-top: 16px;
        margin-bottom: 16px;
        color: var(--hero-text-color, #ffffff);
        background-color: rgba(0,0,0,0.4);
        display: inline-block;
        padding: 17px 20px 12px;
    }

    .hero-widget .before-text {
        font-size: 24px;
        line-height: 24px;
        font-weight: 500;
        margin: 0;
        color: var(--hero-decor-color, #ffffff);
    }
    
    .hero-widget .after-text {
        font-size: 24px;
        line-height: 24px;
        font-weight: 500;
        margin: 0;
        color: var(--hero-text-color, #ffffff);
    }
    
    @media (max-width: 768px) {
        .hero-widget {
            padding: 0;
        }
        
        .hero-widget h1 {
            font-size: 32px;
            line-height: 36px;
        }
        
        .hero-widget .before-text {
            font-size: 18px;
        }
        
        .hero-widget .after-text {
            font-size: 18px;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeroConfig

    def render_with_style(self, config, theme):
        """
        Render hero with custom component style from theme.

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

        # Render the hero HTML using the default template first
        from django.template.loader import render_to_string

        hero_html = render_to_string(
            self.template_name, {"config": prepared_config, "widget_type": self}
        )

        # Prepare context with rendered hero as content
        context = prepare_component_context(
            content=hero_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions and layout properties.
        """
        from file_manager.imgproxy import imgproxy_service
        from webpages.utils.color_utils import resolve_color_value

        template_config = config.copy() if config else {}

        # Get theme colors for CSS variable conversion
        theme = context.get("theme") if context else None
        theme_colors = theme.colors if theme and hasattr(theme, "colors") else {}

        # Build CSS variables for colors
        style_parts = []

        text_color = config.get("text_color", "#ffffff")
        decor_color = config.get("decor_color", "#cccccc")
        background_color = config.get("background_color", "#000000")

        # Convert color names to CSS variables if they're in theme colors
        text_color = resolve_color_value(text_color, theme_colors)
        decor_color = resolve_color_value(decor_color, theme_colors)
        background_color = resolve_color_value(background_color, theme_colors)

        style_parts.append(f"--hero-text-color: {text_color};")
        style_parts.append(f"--hero-decor-color: {decor_color};")
        style_parts.append(f"--hero-bg-color: {background_color};")

        # Process background image if provided
        image = config.get("image")
        if image:
            imgproxy_base_url = image.get("imgproxy_base_url")
            if imgproxy_base_url:
                # Generate responsive image URL (large hero size)
                image_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=1920,
                    height=1080,
                    resize_type="fill",
                )
                if image_url:
                    template_config["background_image_url"] = image_url

        # Join all style parts
        template_config["hero_style"] = " ".join(style_parts)

        # Extract layout properties from theme for dynamic sizing (similar to Banner/ContentCard)
        theme = context.get("theme") if context else None
        if theme and hasattr(theme, "design_groups"):
            design_groups = theme.design_groups or {}
            groups = design_groups.get("groups", [])

            # Find layout properties for hero parts
            for group in groups:
                layout_props = group.get("layoutProperties") or group.get(
                    "layout_properties", {}
                )

                # Extract properties for hero-widget (main container)
                if "hero-widget" in layout_props:
                    part_props = layout_props["hero-widget"]
                    # Note: Layout properties can be applied via CSS from design groups
                    # This is just for awareness - actual application happens in rendering

                # Could extract other hero parts if needed in the future
                # e.g., hero-content, hero-header, etc.

        return template_config
