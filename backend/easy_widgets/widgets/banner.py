"""
Banner widget implementation.
"""

import logging
from typing import Type

from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget
from widget_contracts.models import BannerConfig

logger = logging.getLogger(__name__)


@register_widget_type
@catalog_widget
class BannerWidget(BaseWidget):
    """Banner widget with flexible text and image layouts"""

    description = "Flexible banner with text content and configurable image layouts"
    template_name = "easy_widgets/widgets/banner.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return BannerConfig

    def _render_config(self, config):
        """Keep inactive images stored, but exclude them from every render context."""
        config = {**(config or {}), **BannerConfig(**(config or {})).model_dump(exclude_unset=True)}
        inactive_fields = (
            (
                "image_1",
                "image1",
                "image_1_url",
                "image1Url",
                "image_1_url_2x",
                "image1Url2x",
                "image_size",
                "imageSize",
            )
            if config.get("banner_mode", "text") == "header"
            else (
                "background_image",
                "backgroundImage",
                "background_image_url",
                "backgroundImageUrl",
                "background_image_url_2x",
                "backgroundImageUrl2x",
            )
        )
        for field in inactive_fields:
            config.pop(field, None)
        return config

    def render_with_style(self, config, theme):
        """
        Render banner with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) - always renders using template
        """
        from webpages.utils.mustache_renderer import prepare_component_context, render_mustache

        config = self._render_config(config)
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
        banner_mode = config.get("banner_mode", "text")

        # Select content based on mode
        content = config.get("header_content", "") if banner_mode == "header" else config.get("text_content", "")

        # Prepare context with all widget data
        context = prepare_component_context(
            content=content,
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Add banner specific context
        context["bannerMode"] = banner_mode
        context["headerContent"] = config.get("header_content", "")
        context["textContent"] = config.get("text_content", "")
        context["imageSize"] = config.get("image_size", "square")
        context["backgroundImage"] = config.get("background_image")

        # Add image URL (only for text mode)
        context["image1"] = config.get("image_1")

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions and layout properties.
        """
        from webpages.services.link_resolver import resolve_links_in_html
        from webpages.utils.color_utils import resolve_color_value

        config = self._render_config(config)
        template_config = config.copy() if config else {}
        request = context.get("request") if context else None

        # Resolve links in rich text fields
        header_content = config.get("header_content", "")
        if header_content:
            template_config["header_content"] = resolve_links_in_html(header_content, request)

        text_content = config.get("text_content", "")
        if text_content:
            template_config["text_content"] = resolve_links_in_html(text_content, request)

        # Get theme colors for CSS variable conversion
        theme = context.get("theme") if context else None
        theme_colors = theme.colors if theme and hasattr(theme, "colors") else {}

        # Build inline styles for colors (direct application)
        style_parts = []

        text_color = config.get("text_color", "#000000")
        background_color = config.get("background_color", "#ffffff")

        # Convert color names to CSS variables if they're in theme colors
        text_color = resolve_color_value(text_color, theme_colors)
        background_color = resolve_color_value(background_color, theme_colors)

        style_parts.append(f"background-color: {background_color};")
        style_parts.append(f"color: {text_color};")
        style_parts.append(f"--banner-text-color: {text_color};")
        from webpages.text_outline_styles import RESERVED_KEYS, STYLE_KEY

        outline = config.get("text_outline", "none")
        shadow = "none"
        if STYLE_KEY.fullmatch(outline) and outline not in RESERVED_KEYS:
            shadow = f"var(--text-outline-{outline}, none)"
        style_parts.append(f"--banner-text-shadow: {shadow};")

        # Join all style parts
        template_config["banner_style"] = " ".join(style_parts)

        # Ensure snake_case fields for template
        template_config["banner_mode"] = config.get("banner_mode", "text")
        template_config["header_content"] = config.get("header_content", "")
        template_config["text_content"] = config.get("text_content", "")
        template_config["image_size"] = config.get("image_size", "square")
        template_config["component_style"] = config.get("component_style", "default")
        template_config["show_border"] = config.get("show_border", False)

        # Handle background_image (now a dict MediaFile object)
        background_image = config.get("background_image")
        if background_image and isinstance(background_image, dict):
            # Extract URL from MediaFile object
            bg_url = background_image.get("imgproxy_base_url") or background_image.get("file_url")
            template_config["background_image_url"] = bg_url
        else:
            template_config["background_image_url"] = None
        template_config["background_image"] = background_image

        # Handle image_1 (now a dict MediaFile object, only for text mode)
        image_1 = config.get("image_1")
        if image_1 and isinstance(image_1, dict):
            # Extract URL from MediaFile object
            image_url = image_1.get("imgproxy_base_url") or image_1.get("file_url")
            template_config["image_1_url"] = image_url
        else:
            template_config["image_1_url"] = None
        template_config["image_1"] = image_1

        return template_config
