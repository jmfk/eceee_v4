"""
Simple two-column widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field

from webpages.renderers import WebPageRenderer
from webpages.widget_registry import BaseWidget, register_widget_type


class TwoColumnsConfig(BaseModel):
    """Configuration for simple two-column widget"""

    layout_style: Optional[str] = Field(
        None,
        description="Select widget layout",
        json_schema_extra={
            "component": "SelectInput",
            "order": 1,
            "group": "Display Options",
            "valueListName": "two-column-layout",  # References a value list
            "placeholder": "Select layout...",
        },
    )


@register_widget_type
class TwoColumnsWidget(BaseWidget):
    """Simple two-column widget with left and right slots"""

    name = "Two Columns"
    description = "Simple two-column layout with left and right slots for widgets"
    template_name = "default_widgets/widgets/two_columns.html"

    widget_css = """
    .two-columns-widget {
        display: grid;
        grid-template-columns: 1fr 1fr;
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
    
    .column-slot.right {
        grid-area: 1 / 2;
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
    @media (max-width: 768px) {
        .two-columns-widget {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
        }
        
        .column-slot.left {
            grid-area: 1 / 1;
        }
        
        .column-slot.right {
            grid-area: 2 / 1;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TwoColumnsConfig

    @classmethod
    def get_slot_definitions(cls):
        """
        Define the slots this container widget provides.
        Dimensions are fractions of parent widget's space.
        """
        return {
            "left": {
                "name": "left",
                "title": "Left Column",
                "description": "Left column content",
                "max_widgets": 10,
                "dimensions": {
                    # On mobile: stacks vertically, takes full width
                    "mobile": {"width": 1.0, "height": None},
                    # On tablet/desktop: side-by-side, each takes ~48% (accounting for gap)
                    "tablet": {"width": 0.48, "height": None},
                    "desktop": {"width": 0.48, "height": None},
                },
            },
            "right": {
                "name": "right",
                "title": "Right Column",
                "description": "Right column content",
                "max_widgets": 10,
                "dimensions": {
                    "mobile": {"width": 1.0, "height": None},
                    "tablet": {"width": 0.48, "height": None},
                    "desktop": {"width": 0.48, "height": None},
                },
            },
        }

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering and dimension propagation"""
        request = context["request"]
        renderer = WebPageRenderer(request=request)
        template_config = super().prepare_template_context(config, context)

        # Get this widget's dimensions from context (passed from parent)
        parent_dimensions = self.get_widget_dimensions(context)

        # Get slot definitions with dimensions
        slot_defs = self.get_slot_definitions()

        # Get slots data (like PageVersion.widgets)
        slots_data = config.get("slots", {"left": [], "right": []})

        # Render widgets for each slot using existing renderer
        rendered_slots = {}
        if context and renderer:
            for slot_name, widgets in slots_data.items():
                rendered_widgets = []

                # Calculate dimensions for this nested slot
                slot_def = slot_defs.get(slot_name, {})
                slot_dim_fractions = slot_def.get("dimensions", {})

                # Calculate pixel dimensions based on parent
                nested_slot_dimensions = self.calculate_nested_slot_dimensions(
                    parent_dimensions, slot_dim_fractions
                )

                for widget_data in widgets:
                    try:
                        # Pass calculated dimensions to nested widget
                        widget_html = renderer.render_widget_json(
                            widget_data, context, slot_dimensions=nested_slot_dimensions
                        )
                        rendered_widgets.append(
                            {"html": widget_html, "widget_data": widget_data}
                        )
                    except Exception as e:
                        # Log error and continue
                        import logging

                        logger = logging.getLogger(__name__)
                        logger.error(f"Error rendering nested widget: {e}")
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
