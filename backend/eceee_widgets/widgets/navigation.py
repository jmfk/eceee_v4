"""
Navigation widget implementation.
"""

from typing import Type, Optional, List, Literal, Union, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class NavigationItem(BaseModel):
    """Navigation menu item"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Allow both snake_case and camelCase
    )

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(True, description="Whether this item is active")
    target_blank: bool = Field(
        False, description="Whether the link opens in a new window"
    )


# Update forward reference
NavigationItem.model_rebuild()


class PageSectionConfig(BaseModel):
    """Page Section configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    label: str = Field(..., description="Page Section label")


class PageSubmenuConfig(BaseModel):
    """Page Submenu configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    label: str = Field(..., description="Page Submenu label")


class NavigationConfig(BaseModel):
    """Configuration for Navigation widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menus: Optional[Literal["pageSections", "pageSubmenu", "none"]] = Field(
        default="none",
        description="Menu type to display",
        json_schema_extra={
            "component": "ConditionalGroupField",
            "groups": {
                "pageSections": {
                    "label": "Page Section",
                    "config_model": "PageSectionConfig",
                },
                "pageSubmenu": {
                    "label": "Page Submenu",
                    "config_model": "PageSubmenuConfig",
                },
                "none": {
                    "label": "None",
                },
            },
        },
    )

    menus_config: Optional[
        Union[PageSectionConfig, PageSubmenuConfig, Dict[str, Any]]
    ] = Field(
        default=None,
        description="Configuration data for the selected menu type",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by ConditionalGroupField
        },
    )

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

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig
