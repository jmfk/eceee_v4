"""
Headline widget implementation.
"""

import logging
from typing import Type

from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget
from widget_contracts.models import HeadlineConfig

logger = logging.getLogger(__name__)


@register_widget_type
@catalog_widget
class HeadlineWidget(BaseWidget):
    """Headline widget for displaying header text"""

    description = "Header text widget for page sections"
    template_name = "easy_widgets/widgets/headline.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeadlineConfig

    def render_with_style(self, config, theme):
        """
        Render headline with custom component style from theme.

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
            config=config,  # Pass raw config for granular control (includes header_level)
        )

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions.
        """
        from webpages.services.link_resolver import resolve_links_in_html

        template_config = config.copy() if config else {}

        # Resolve links in content
        if template_config.get("content"):
            template_config["content"] = resolve_links_in_html(
                template_config["content"], context.get("request") if context else None
            )

        # Ensure snake_case fields for template
        template_config["component_style"] = config.get("component_style", "default")
        template_config["show_border"] = config.get("show_border", True)
        template_config["header_level"] = config.get("header_level", "h1")

        return template_config
