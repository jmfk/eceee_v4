"""
Navigation widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field

from webpages.widget_registry import BaseWidget, register_widget_type


class NavigationItem(BaseModel):
    """Navigation menu item"""

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(False, description="Whether this item is active")


# Update forward reference
NavigationItem.model_rebuild()


class NavigationConfig(BaseModel):
    """Configuration for Navigation widget"""

    menu_items: List[NavigationItem] = Field(
        default_factory=list,
        description="Navigation menu items",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Menu Item",
            "emptyText": "No menu items added yet",
            "itemLabelTemplate": "label",  # Use the label field for item display
        },
    )


@register_widget_type
class NavigationWidget(BaseWidget):
    """Navigation widget with background and text styling options"""

    name = "Navigation"
    description = "Navigation widget with background image/color and text color options"
    template_name = "eceee_widgets/widgets/navigation.html"

    widget_css = """"""

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig
