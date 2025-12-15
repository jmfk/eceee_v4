"""
Footer widget implementation.
"""

from typing import Type, Optional, Literal, Dict, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


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
class FooterWidget(BaseWidget):
    """Footer widget with single content slot and background styling"""

    app_label = "easy_widgets"
    name = "Footer"
    description = "Footer container with content slot and background styling options"
    template_name = "easy_widgets/widgets/footer.html"

    layout_parts = {
        "footer-widget": {
            "label": "Footer widget container",
            "selector": ".footer-widget",
            "properties": [
                "width",
                "height",
                "backgroundColor",
                "backgroundImage",
            ],
        },
    }

    widget_css = """
    .widget-type-footer {
        box-sizing: border-box;
        width: 100%;
        min-height: 310px;
        flex: 1;
        display: flex;
        flex-direction: column;
        background-image: var(--footer-widget-background-sm, none);
        background-color: var(--footer-bg-color-sm, transparent);
        color: var(--footer-text-color-sm, inherit);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
    }

    @media (min-width: 768px) {
        .widget-type-footer {
            background-image: var(--footer-widget-background-md, var(--footer-widget-background-sm, none));
            background-color: var(--footer-bg-color-md, var(--footer-bg-color-sm, transparent));
            color: var(--footer-text-color-md, var(--footer-text-color-sm, inherit));
        }
    }

    @media (min-width: 1024px) {
        .widget-type-footer {
            background-image: var(--footer-widget-background-lg, var(--footer-widget-background-md, var(--footer-widget-background-sm, none)));
            background-color: var(--footer-bg-color-lg, var(--footer-bg-color-md, var(--footer-bg-color-sm, transparent)));
            color: var(--footer-text-color-lg, var(--footer-text-color-md, var(--footer-text-color-sm, inherit)));
        }
    }

    @media (min-width: 1280px) {
        .widget-type-footer {
            background-image: var(--footer-widget-background-xl, var(--footer-widget-background-lg, var(--footer-widget-background-md, var(--footer-widget-background-sm, none))));
            background-color: var(--footer-bg-color-xl, var(--footer-bg-color-lg, var(--footer-bg-color-md, var(--footer-bg-color-sm, transparent)));
            color: var(--footer-text-color-xl, var(--footer-text-color-lg, var(--footer-text-color-md, var(--footer-text-color-sm, inherit)));
        }
    }
    
    .empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        font-size: 16px;
        font-weight: 300;
        padding: 30px;
    }
    """

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
                    is_visible = widget_config.get(
                        "isVisible", widget_config.get("is_visible", True)
                    )
                    if not is_visible:
                        continue

                    # Filter out inactive widgets
                    is_active = widget_config.get(
                        "isActive", widget_config.get("is_active", True)
                    )
                    if not is_active:
                        continue

                    # Add sort_order if missing
                    if "sort_order" not in widget_data and "order" not in widget_data:
                        widget_data = {**widget_data, "sort_order": index}

                    widget_html = context["renderer"].render_widget_json(
                        widget_data, context
                    )
                    rendered_widgets.append(
                        {"html": widget_html, "widget_data": widget_data}
                    )
                except Exception as e:
                    continue
            rendered_slots["content"] = rendered_widgets
        else:
            # Fallback: provide raw widget data
            rendered_slots = {
                "content": [
                    {"html": None, "widget_data": widget}
                    for widget in slots_data.get("content", [])
                ]
            }

        template_config.update(
            {"slots_data": slots_data, "rendered_slots": rendered_slots}
        )

        return template_config
