"""
Simple three-column widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class ThreeColumnsConfig(BaseModel):
    """Configuration for simple three-column widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    layout_style: Optional[str] = Field(
        None,
        description="Select widget layout",
        json_schema_extra={
            "component": "SelectInput",
            "order": 1,
            "group": "Display Options",
            "valueListName": "three-column-layout",  # References a value list
            "placeholder": "Select layout...",
        },
    )


@register_widget_type
class ThreeColumnsWidget(BaseWidget):
    """Simple three-column widget with left, center, and right slots"""

    app_label = "eceee_widgets"
    name = "Three Columns"
    description = (
        "Simple three-column layout with left, center, and right slots for widgets"
    )
    template_name = "eceee_widgets/widgets/three_columns.html"

    widget_css = """
    .three-columns-widget {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
        width: 100%;
        margin-bottom: 1rem;
    }
    
    .column-slot {
        position: relative;
        min-height: 50px;
    }
    
    .column-slot.left {
        grid-area: 1 / 1;
    }
    
    .column-slot.center {
        grid-area: 1 / 2;
    }
    
    .column-slot.right {
        grid-area: 1 / 3;
    }
    
    .widget-wrapper {
        margin-bottom: 0.75rem;
    }
    
    .widget-wrapper:last-child {
        margin-bottom: 0;
    }
    
    .empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
        border: 2px dashed #e5e7eb;
        border-radius: 0.5rem;
        background-color: #f9fafb;
    }
    
    /* Responsive design */
    @media (max-width: 1024px) {
        .three-columns-widget {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto;
        }
        
        .column-slot.left {
            grid-area: 1 / 1;
        }
        
        .column-slot.center {
            grid-area: 1 / 2;
        }
        
        .column-slot.right {
            grid-area: 2 / 1 / 2 / 3;
        }
    }
    
    @media (max-width: 768px) {
        .three-columns-widget {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
        }
        
        .column-slot.left {
            grid-area: 1 / 1;
        }
        
        .column-slot.center {
            grid-area: 2 / 1;
        }
        
        .column-slot.right {
            grid-area: 3 / 1;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ThreeColumnsConfig

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering like PageVersion"""
        template_config = super().prepare_template_context(config, context)

        # Get slots data (like PageVersion.widgets)
        slots_data = config.get("slots", {"left": [], "center": [], "right": []})

        # Render widgets for each slot using existing renderer
        rendered_slots = {}
        if context and "renderer" in context:
            for slot_name, widgets in slots_data.items():
                rendered_widgets = []
                for widget_data in widgets:
                    try:
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
