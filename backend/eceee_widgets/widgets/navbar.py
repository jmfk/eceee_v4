"""
Navbar widget implementation.
"""

from typing import Type, List, Optional, Literal
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
    background_image: Optional[str] = Field(
        None,
        description="Background image URL",
        json_schema_extra={
            "component": "ImageInput",
            "order": 2,
            "mediaTypes": ["image"],
        },
    )
    background_position: Literal["center", "top", "bottom", "left", "right"] = Field(
        "center",
        description="Background image position/alignment",
        json_schema_extra={
            "component": "SelectInput",
            "order": 3,
            "options": [
                {"value": "center", "label": "Center"},
                {"value": "top", "label": "Top"},
                {"value": "bottom", "label": "Bottom"},
                {"value": "left", "label": "Left"},
                {"value": "right", "label": "Right"},
            ],
        },
    )
    background_color: Optional[str] = Field(
        None,
        description="Background color (hex or CSS color)",
        json_schema_extra={
            "component": "ColorInput",
            "order": 4,
        },
    )


@register_widget_type
class NavbarWidget(BaseWidget):
    """Navbar widget with configurable menu items"""

    name = "Navbar"
    description = "Navigation bar with configurable menu items"
    template_name = "eceee_widgets/widgets/navbar.html"

    widget_css = """
    .navbar-widget {
        background-color: var(--navbar-bg-color, #3b82f6);
        background-image: var(--navbar-bg-image, none);
        background-size: var(--navbar-bg-size, cover);
        background-position: var(--navbar-bg-position, center);
        background-repeat: var(--navbar-bg-repeat, no-repeat);
        box-shadow: var(--navbar-shadow, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
        height: var(--navbar-height, 28px);
    }
    
    .navbar-widget ul {
        display: flex;
        gap: var(--navbar-gap, 1.5rem);
        list-style: none;
        margin: 0;
        padding: 0 0 0 var(--navbar-padding-left, 20px);
        align-items: center;
        height: 100%;
    }
    
    .navbar-widget a {
        color: var(--navbar-link-color, #ffffff);
        font-size: var(--navbar-font-size, 0.875rem);
        font-weight: var(--navbar-font-weight, 500);
        text-decoration: none;
        transition: opacity 0.2s ease-in-out;
    }
    
    .navbar-widget a:hover {
        opacity: var(--navbar-link-hover-opacity, 0.8);
    }
    """

    css_variables = {
        "navbar-bg-color": "#3b82f6",
        "navbar-bg-image": "none",
        "navbar-bg-size": "cover",
        "navbar-bg-position": "center",
        "navbar-bg-repeat": "no-repeat",
        "navbar-shadow": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "navbar-height": "28px",
        "navbar-gap": "1.5rem",
        "navbar-padding-left": "20px",
        "navbar-link-color": "#ffffff",
        "navbar-font-size": "0.875rem",
        "navbar-font-weight": "500",
        "navbar-link-hover-opacity": "0.8",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavbarConfig

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items and background styling"""
        template_config = super().prepare_template_context(config, context)
        return template_config
