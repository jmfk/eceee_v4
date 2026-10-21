"""
Forms widget implementation.
"""

from typing import Type

from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget
from widget_contracts.models import FormField, FormsConfig  # noqa: F401 - public model schema lookup


@register_widget_type
@catalog_widget
class FormsWidget(BaseWidget):
    """Forms widget with schema support"""

    description = "Forms widget with schema support for building custom forms"
    template_name = "easy_widgets/widgets/forms.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FormsConfig

    def prepare_template_context(self, config, context=None):
        """Normalize the frontend-owned camelCase payload for Django templates."""
        normalized = FormsConfig(**(config or {})).model_dump()
        return super().prepare_template_context(normalized, context)

    def render_with_style(self, config, theme):
        """
        Render form with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from django.template.loader import render_to_string

        from webpages.utils.mustache_renderer import prepare_component_context, render_mustache

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        # Render the form HTML using the default template first
        form_html = render_to_string(self.template_name, {"config": config})

        # Prepare context with rendered form as content
        context = prepare_component_context(
            content=form_html,
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
