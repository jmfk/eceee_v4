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
            "component": "TextAreaInput",
            "order": 2,
            "placeholder": "Optional text before header",
            "rows": 3,
        },
    )

    after_text: Optional[str] = Field(
        None,
        description="Text displayed after the header",
        json_schema_extra={
            "component": "TextAreaInput",
            "order": 3,
            "placeholder": "Optional text after header",
            "rows": 3,
        },
    )

    image: Optional[str] = Field(
        None,
        description="Background or featured image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 4,
            "mediaTypes": ["image"],
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

    widget_css = """
    .hero-widget {
        position: relative;
        padding: var(--hero-padding, 4rem 2rem);
        background-color: var(--hero-bg-color);
        color: var(--hero-text-color);
        overflow: hidden;
    }
    
    .hero-widget .hero-background {
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
    
    .hero-widget .hero-content {
        position: relative;
        z-index: 1;
        max-width: var(--hero-max-width, 1200px);
        margin: 0 auto;
        text-align: center;
    }
    
    .hero-widget .before-text {
        font-size: var(--hero-before-text-size, 1.125rem);
        margin-bottom: var(--hero-before-text-margin, 1rem);
        color: var(--hero-decor-color);
    }
    
    .hero-widget h1 {
        font-size: var(--hero-header-size, 3rem);
        font-weight: var(--hero-header-weight, 700);
        margin: var(--hero-header-margin, 1rem 0);
        line-height: var(--hero-header-line-height, 1.2);
    }
    
    .hero-widget .after-text {
        font-size: var(--hero-after-text-size, 1.25rem);
        margin-top: var(--hero-after-text-margin, 1rem);
        color: var(--hero-text-color);
    }
    
    @media (max-width: 768px) {
        .hero-widget {
            padding: var(--hero-padding-mobile, 2rem 1rem);
        }
        
        .hero-widget h1 {
            font-size: var(--hero-header-size-mobile, 2rem);
        }
        
        .hero-widget .before-text {
            font-size: var(--hero-before-text-size-mobile, 1rem);
        }
        
        .hero-widget .after-text {
            font-size: var(--hero-after-text-size-mobile, 1.125rem);
        }
    }
    """

    css_variables = {
        "hero-padding": "4rem 2rem",
        "hero-padding-mobile": "2rem 1rem",
        "hero-max-width": "1200px",
        "hero-header-size": "3rem",
        "hero-header-size-mobile": "2rem",
        "hero-header-weight": "700",
        "hero-header-margin": "1rem 0",
        "hero-header-line-height": "1.2",
        "hero-before-text-size": "1.125rem",
        "hero-before-text-size-mobile": "1rem",
        "hero-before-text-margin": "1rem",
        "hero-after-text-size": "1.25rem",
        "hero-after-text-size-mobile": "1.125rem",
        "hero-after-text-margin": "1rem",
    }

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
        from webpages.utils.mustache_renderer import render_mustache, prepare_component_context
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
        
        # Render the hero HTML using the default template first
        hero_html = render_to_string(
            self.template_name,
            {"config": prepared_config}
        )
        
        # Prepare context with rendered hero as content
        context = prepare_component_context(
            content=hero_html,
            anchor="",
            style_vars=style.get("variables", {})
        )
        
        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css

    def prepare_template_context(self, config, context=None):
        """Prepare hero template context with image processing and color variables"""
        from file_manager.imgproxy import imgproxy_service

        template_config = super().prepare_template_context(config, context)

        # Build CSS variables for colors
        style_parts = []
        
        text_color = config.get("text_color", "#ffffff")
        decor_color = config.get("decor_color", "#cccccc")
        background_color = config.get("background_color", "#000000")
        
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

        return template_config

