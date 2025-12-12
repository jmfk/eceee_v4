"""
Simple three-column widget implementation.
"""

from typing import Type, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class ThreeColumnsConfig(BaseModel):
    """Configuration for simple three-column widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    layout_style: Optional[Literal["3:2:1", "2:2:2", "1:2:3", "1:4:1"]] = Field(
        "2:2:2",
        description="Column width ratio",
        json_schema_extra={
            "component": "ThreeColumnRatioSelector",
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
class ThreeColumnsWidget(BaseWidget):
    """Simple three-column widget with left, center, and right slots"""

    app_label = "easy_widgets"
    name = "Three Columns"
    description = (
        "Simple three-column layout with left, center, and right slots for widgets"
    )
    template_name = "easy_widgets/widgets/three_columns.html"

    layout_parts = {
        "three-columns-widget": {
            "label": "Three Columns container",
            "selector": ".three-columns-widget",
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
        "three-col-widget-wrapper": {
            "label": "Three Columns Wrappercontainer",
            "selector": ".three-col-widget-wrapper",
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
                "color",
            ],
        },
    }

    widget_css = """
    .three-columns-widget {
        display: grid;
        gap: 30px;
        width: 100%;
        min-height: 140px;
        margin-bottom: 30px;
    }
    .three-columns-widget:last-child {
        margin-bottom: 0;
    }
    
    
    .three-columns-widget.three-col-ratio-3-2-1 {
        grid-template-columns: 3fr 2fr 1fr;
    }
    
    .three-columns-widget.three-col-ratio-2-2-2 {
        grid-template-columns: 1fr 1fr 1fr;
    }
    
    .three-columns-widget.three-col-ratio-1-2-3 {
        grid-template-columns: 1fr 2fr 3fr;
    }
    
    .three-columns-widget.three-col-ratio-1-4-1 {
        grid-template-columns: 1fr 4fr 1fr;
    }
    
    .three-col-slot {
        position: relative;
        min-height: 140px;
        height: 100%;
    }
    
    .three-col-slot.left {
        grid-area: 1 / 1;
    }
    
    .three-col-slot.center {
        grid-area: 1 / 2;
    }
    
    .three-col-slot.right {
        grid-area: 1 / 3;
    }
    
    .three-col-widget-wrapper {
        margin-bottom: 30px;
    }
    
    .three-col-widget-wrapper:last-child {
        margin-bottom: 0;
    }
    
    .three-col-empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
        border: 1px dashed #e5e7eb;
        background-color: #f9fafb;
        height: 100%;
    }
    
    /* Responsive design */
    @media (max-width: 1024px) {
        .three-columns-widget {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto;
        }
        
        .three-col-slot.left {
            grid-area: 1 / 1;
        }
        
        .three-col-slot.center {
            grid-area: 1 / 2;
        }
        
        .three-col-slot.right {
            grid-area: 2 / 1 / 2 / 3;
        }
    }
    
    @media (max-width: 768px) {
        .three-columns-widget {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
        }
        
        .three-col-slot.left {
            grid-area: 1 / 1;
        }
        
        .three-col-slot.center {
            grid-area: 2 / 1;
        }
        
        .three-col-slot.right {
            grid-area: 3 / 1;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ThreeColumnsConfig

    def render_with_style(self, config, theme):
        """
        Render three-column widget with custom component style from theme.

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
        layout_style = config.get("layout_style", "2:2:2")
        ratio_class = f"three-col-ratio-{layout_style.replace(':', '-')}"
        template_config["ratio_class"] = ratio_class

        # Get slots data (like PageVersion.widgets)
        slots_data = config.get("slots", {"left": [], "center": [], "right": []})

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
