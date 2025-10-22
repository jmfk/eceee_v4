"""
Navbar widget implementation.
"""

from typing import Type, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class NavbarItem(BaseModel):
    """Navbar menu item"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Allow both snake_case and camelCase
    )

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    target_blank: bool = Field(
        False, description="Whether the link opens in a new window"
    )


class NavbarConfig(BaseModel):
    """Configuration for Navbar widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menu_items: List[NavbarItem] = Field(
        default_factory=list,
        description="Navbar menu items",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Menu Item",
            "emptyText": "No menu items added yet",
            "itemLabelTemplate": "label",  # Use the label field for item display
        },
    )


@register_widget_type
class NavbarWidget(BaseWidget):
    """Navbar widget with configurable menu items"""

    name = "Navbar"
    description = "Navigation bar with configurable menu items"
    template_name = "eceee_widgets/widgets/navbar.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavbarConfig

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items"""
        template_config = super().prepare_template_context(config, context)
        return template_config
