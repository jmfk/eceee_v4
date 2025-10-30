"""
Navbar widget implementation.
"""

from typing import Type, List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from file_manager.imgproxy import imgproxy_service
from utils.dict_utils import DictToObj


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


class SecondaryMenuItem(BaseModel):
    """Secondary navbar menu item with custom styling"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    target_blank: bool = Field(
        False, description="Whether the link opens in a new window"
    )
    background_color: Optional[str] = Field(
        None,
        description="Individual background color (hex or CSS color)",
        json_schema_extra={"component": "ColorInput"},
    )
    background_image: Optional[str] = Field(
        None,
        description="Individual background image URL",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
        },
    )


class NavbarConfig(BaseModel):
    """Configuration for Navbar widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menu_items: List[NavbarItem] = Field(
        default_factory=list,
        description="Primary navbar menu items (left-aligned)",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Menu Item",
            "emptyText": "No menu items added yet",
            "itemLabelTemplate": "label",  # Use the label field for item display
            "hidden": True,  # Hidden from UI - managed by NavbarWidgetEditor
        },
    )
    secondary_menu_items: List[SecondaryMenuItem] = Field(
        default_factory=list,
        description="Secondary navbar menu items (right-aligned, with custom colors)",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Secondary Menu Item",
            "emptyText": "No secondary menu items added yet",
            "itemLabelTemplate": "label",
            "hidden": True,  # Hidden from UI - managed by NavbarWidgetEditor
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
    background_alignment: Literal["left", "center", "right"] = Field(
        "center",
        description="Background Alignment",
        json_schema_extra={
            "component": "SelectInput",
            "order": 3,
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
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
    hamburger_breakpoint: int = Field(
        768,
        ge=320,
        le=2560,
        description="Screen width (px) below which to show hamburger menu",
        json_schema_extra={
            "component": "NumberInput",
            "order": 5,
            "min": 320,
            "max": 2560,
            "step": 1,
            "suffix": "px",
        },
    )


@register_widget_type
class NavbarWidget(BaseWidget):
    """Navbar widget with configurable menu items"""

    name = "Navbar"
    description = "Navigation bar with configurable menu items"
    template_name = "easy_widgets/widgets/navbar.html"

    widget_css = """"""

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavbarConfig

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items and background styling"""
        template_config = super().prepare_template_context(config, context)
        context = DictToObj(context)

        # Build complete inline style string in Python
        style_parts = []

        # Handle background image
        background_image = config.get("background_image")
        if background_image:
            imgproxy_base_url = background_image.get("imgproxy_base_url")
            imgproxy_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=context.slot.dimensions.desktop.width,
                height=context.slot.dimensions.desktop.height or 28,
                resize_type="fill",
            )

            if imgproxy_url:
                background_alignment = config.get("background_alignment", "left")
                style_parts.append(f"background-image: url('{imgproxy_url}');")
                style_parts.append("background-size: cover;")
                # Use two-value syntax for background-position (horizontal vertical)
                style_parts.append(
                    f"background-position: {background_alignment} center;"
                )
                style_parts.append("background-repeat: no-repeat;")

        # Handle background color with fallback logic
        background_color = config.get("background_color")
        if not background_color:
            background_color = "#3b82f6"

        if background_color:
            style_parts.append(f"background-color: {background_color};")

        # Add fixed styles
        style_parts.append("box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);")
        style_parts.append("height: 28px;")

        # Join all style parts with a space
        template_config["navbar_style"] = " ".join(style_parts)

        return template_config
