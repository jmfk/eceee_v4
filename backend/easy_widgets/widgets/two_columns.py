"""
Simple two-column widget implementation.
"""

from typing import Type, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class TwoColumnsConfig(BaseModel):
    """Configuration for simple two-column widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    layout_style: Optional[Literal["5:1", "4:2", "3:3", "2:4", "1:5"]] = Field(
        "3:3",
        description="Column width ratio",
        json_schema_extra={
            "component": "TwoColumnRatioSelector",
            "order": 1,
            "group": "Display Options",
        },
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
class TwoColumnsWidget(BaseWidget):
    """Simple two-column widget with left and right slots"""

    app_label = "easy_widgets"
    name = "Two Columns"
    description = "Simple two-column layout with left and right slots for widgets"
    template_name = "easy_widgets/widgets/two_column.html"

    layout_parts = {
        "two-columns-widget": {
            "label": "Two Columns container",
            "selector": ".two-columns-widget",
            "properties": [
                "width",
                "height",
                "min-height",
                "padding",
                "margin",
                "backgroundColor",
                "color",
                "fontFamily",
                "fontSize",
                "lineHeight",
                "gap",
            ],
        },
    }

    widget_css = """
    .two-columns-widget {
        display: grid;
        gap: 30px;
        width: 100%;
        margin-bottom: 30px;
    }
    .two-columns-widget:last-child {
        margin-bottom: 0;
    }
    
    .two-columns-widget.two-col-ratio-5-1 {
        grid-template-columns: 5fr 1fr;
    }
    
    .two-columns-widget.two-col-ratio-4-2 {
        grid-template-columns: 2fr 1fr;
    }
    
    .two-columns-widget.two-col-ratio-3-3 {
        grid-template-columns: 1fr 1fr;
    }
    
    .two-columns-widget.two-col-ratio-2-4 {
        grid-template-columns: 1fr 2fr;
    }
    
    .two-columns-widget.two-col-ratio-1-5 {
        grid-template-columns: 1fr 5fr;
    }
    
    .two-col-slot {
        position: relative;
        height: 100%;
    }
    
    .two-col-slot.left {
        grid-area: 1 / 1;
    }
    
    .two-col-slot.right {
        grid-area: 1 / 2;
    }
    
    .two-col-widget-wrapper {
        margin-bottom: 30px;
    }
    
    .two-col-widget-wrapper:last-child {
        margin-bottom: 0;
    }
    
    .two-col-empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
        border: 1px dashed #e5e7eb;
        background-color: #f9fafb;
        height: 100%;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
        .two-columns-widget {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
        }
        
        .two-col-slot.left {
            grid-area: 1 / 1;
        }
        
        .two-col-slot.right {
            grid-area: 2 / 1;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TwoColumnsConfig

    def render_with_style(self, config, theme):
        """
        Render two-column widget with custom component style from theme.

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
        from django.template.loader import render_to_string

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
            slots=prepared_config.get(
                "rendered_slots"
            ),  # Pass slot data for custom rendering
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
                        is_visible = widget_config.get(
                            "isVisible", widget_config.get("is_visible", True)
                        )
                        if not is_visible:
                            continue  # Skip hidden widgets

                        # Filter out inactive widgets (check both config.isActive and config.is_active)
                        is_active = widget_config.get(
                            "isActive", widget_config.get("is_active", True)
                        )
                        if not is_active:
                            continue  # Skip inactive widgets

                        # Add sort_order if missing (use array index to preserve order)
                        if (
                            "sort_order" not in widget_data
                            and "order" not in widget_data
                        ):
                            widget_data = {**widget_data, "sort_order": index}

                        widget_html = context["renderer"].render_widget_json(
                            widget_data, context
                        )
                        rendered_widgets.append(
                            {"html": widget_html, "widget_data": widget_data}
                        )
                    except Exception as e:
                        # Log error and continue
                        continue
                rendered_slots[slot_name] = rendered_widgets
        else:
            # Fallback: provide raw widget data for template
            rendered_slots = {
                slot_name: [{"html": None, "widget_data": widget} for widget in widgets]
                for slot_name, widgets in slots_data.items()
            }

        template_config.update(
            {"slots_data": slots_data, "rendered_slots": rendered_slots}
        )

        return template_config
