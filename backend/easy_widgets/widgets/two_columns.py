"""
Simple two-column widget implementation.
"""

from typing import Type

from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget
from widget_contracts.models import TwoColumnsConfig


@register_widget_type
@catalog_widget
class TwoColumnsWidget(BaseWidget):
    """Simple two-column widget with left and right slots"""

    app_label = "easy_widgets"
    description = "Simple two-column layout with left and right slots for widgets"
    template_name = "easy_widgets/widgets/two_column.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TwoColumnsConfig

    @classmethod
    def get_slot_definitions(cls):
        """Define slots for Two Columns widget"""
        return {
            "left": {
                "name": "left",
                "title": "Left Column",
                "description": "Left column content",
                "dimensions": {
                    "mobile": {"width": 1.0, "height": None},
                    "tablet": {"width": 0.5, "height": None},
                    "desktop": {"width": 0.5, "height": None},
                },
            },
            "right": {
                "name": "right",
                "title": "Right Column",
                "description": "Right column content",
                "dimensions": {
                    "mobile": {"width": 1.0, "height": None},
                    "tablet": {"width": 0.5, "height": None},
                    "desktop": {"width": 0.5, "height": None},
                },
            },
        }

    def render_with_style(self, config, theme):
        """
        Render two-column widget with custom component style from theme.

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

        template_str = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template_str.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the widget HTML using the default template first
        widget_html = render_to_string(self.template_name, {"config": prepared_config})

        # Prepare context with rendered widget as content
        context = prepare_component_context(
            content=widget_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
            slots=prepared_config.get("rendered_slots"),  # Pass slot data for custom rendering
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering like PageVersion"""
        template_config = super().prepare_template_context(config, context)

        # Add ratio CSS class based on layout_style
        layout_style = config.get("layout_style", "3:3")
        ratio_class = f"two-col-ratio-{layout_style.replace(':', '-')}"
        template_config["ratio_class"] = ratio_class

        # Get slots data (like PageVersion.widgets)
        slots_data = config.get("slots", {"left": [], "right": []})

        # Render widgets for each slot using existing renderer
        rendered_slots = {}
        if context and "renderer" in context:
            for slot_name, widgets in slots_data.items():
                rendered_widgets = []
                for index, widget_data in enumerate(widgets):
                    try:
                        # Filter out hidden widgets (check both config.isVisible and config.is_visible)
                        widget_config = widget_data.get("config", {})
                        is_visible = widget_config.get("isVisible", widget_config.get("is_visible", True))
                        if not is_visible:
                            continue  # Skip hidden widgets

                        # Filter out inactive widgets (check both config.isActive and config.is_active)
                        is_active = widget_config.get("isActive", widget_config.get("is_active", True))
                        if not is_active:
                            continue  # Skip inactive widgets

                        # Add sort_order if missing (use array index to preserve order)
                        if "sort_order" not in widget_data and "order" not in widget_data:
                            widget_data = {**widget_data, "sort_order": index}

                        widget_html = context["renderer"].render_widget_json(widget_data, context)
                        rendered_widgets.append({"html": widget_html, "widget_data": widget_data})
                    except Exception:
                        # Log error and continue
                        continue
                rendered_slots[slot_name] = rendered_widgets
        else:
            # Fallback: provide raw widget data for template
            rendered_slots = {
                slot_name: [{"html": None, "widget_data": widget} for widget in widgets]
                for slot_name, widgets in slots_data.items()
            }

        template_config.update({"slots_data": slots_data, "rendered_slots": rendered_slots})

        return template_config
