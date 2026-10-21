"""
Footer widget implementation.
"""

from typing import Dict, List, Type

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


class FooterConfig(BaseModel):
    """Configuration for Footer widget with single content slot"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    slots: Dict[str, List] = Field(
        default_factory=lambda: {"content": []},
        description="Widget slots (content slot for footer widgets)",
        json_schema_extra={
            "hidden": True,  # Hidden from form - managed by SlotEditor
        },
    )


@register_widget_type
@catalog_widget
class FooterWidget(BaseWidget):
    """Footer widget with single content slot and background styling"""

    app_label = "easy_widgets"
    description = "Footer container with content slot and background styling options"
    template_name = "easy_widgets/widgets/footer.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig

    def render(self, config, context=None):
        """Override render to skip rendering if footer is empty"""
        # Get slots data
        slots_data = config.get("slots", {"content": []})
        content_widgets = slots_data.get("content", [])

        # If no content widgets, don't render the footer at all
        if not content_widgets or len(content_widgets) == 0:
            return ""

        # Otherwise, use default rendering
        return super().render(config, context)

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering (styling from design groups)"""
        template_config = super().prepare_template_context(config, context)

        # Get slots data (single 'content' slot)
        slots_data = config.get("slots", {"content": []})

        # Render widgets for the content slot using existing renderer
        rendered_slots = {}
        if context and "renderer" in context:
            content_widgets = slots_data.get("content", [])
            rendered_widgets = []
            for index, widget_data in enumerate(content_widgets):
                try:
                    # Filter out hidden widgets
                    widget_config = widget_data.get("config", {})
                    is_visible = widget_config.get("isVisible", widget_config.get("is_visible", True))
                    if not is_visible:
                        continue

                    # Filter out inactive widgets
                    is_active = widget_config.get("isActive", widget_config.get("is_active", True))
                    if not is_active:
                        continue

                    # Add sort_order if missing
                    if "sort_order" not in widget_data and "order" not in widget_data:
                        widget_data = {**widget_data, "sort_order": index}

                    widget_html = context["renderer"].render_widget_json(widget_data, context)
                    rendered_widgets.append({"html": widget_html, "widget_data": widget_data})
                except Exception:
                    continue
            rendered_slots["content"] = rendered_widgets
        else:
            # Fallback: provide raw widget data
            rendered_slots = {
                "content": [{"html": None, "widget_data": widget} for widget in slots_data.get("content", [])]
            }

        template_config.update({"slots_data": slots_data, "rendered_slots": rendered_slots})

        return template_config
