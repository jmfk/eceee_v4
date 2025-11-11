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
    is_active: bool = Field(True, description="Whether this item is active")
    target_blank: bool = Field(
        False, description="Whether the link opens in a new window"
    )
    order: int = Field(0, description="Display order")


class SecondaryMenuItem(BaseModel):
    """Secondary navbar menu item with custom styling"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(True, description="Whether this item is active")
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
    order: int = Field(0, description="Display order")


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
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
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

    def render_with_style(self, config, theme):
        """
        Render navbar with custom component style from theme.
        
        Args:
            config: Widget configuration
            theme: PageTheme instance
            
        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import render_mustache, prepare_component_context
        from django.template.loader import render_to_string
        
        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None
        
        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None
        
        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})
        
        # Render the navbar HTML using the default template first
        navbar_html = render_to_string(
            self.template_name,
            {"config": prepared_config}
        )
        
        # Prepare context with rendered navbar as content
        context = prepare_component_context(
            content=navbar_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )
        
        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items and background styling"""
        template_config = super().prepare_template_context(config, context)
        context_obj = DictToObj(context)

        # Build complete inline style string in Python
        style_parts = []

        # Handle background image
        background_image = config.get("background_image")
        if background_image:
            imgproxy_base_url = background_image.get("imgproxy_base_url")
            imgproxy_url = imgproxy_service.generate_url(
                source_url=imgproxy_base_url,
                width=context_obj.slot.dimensions.desktop.width,
                height=context_obj.slot.dimensions.desktop.height or 28,
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

        # Filter menu items based on publication status (public site only)
        filtered_menu_items = self._filter_published_menu_items(
            config.get("menu_items", []), context
        )
        # Filter out inactive items
        filtered_menu_items = [
            item for item in filtered_menu_items if item.get("is_active", True)
        ]
        # Sort by order field
        filtered_menu_items = sorted(
            filtered_menu_items, key=lambda x: x.get("order", 0)
        )
        template_config["menu_items"] = filtered_menu_items

        # Same for secondary menu items
        filtered_secondary = self._filter_published_menu_items(
            config.get("secondary_menu_items", []), context
        )
        # Filter out inactive items
        filtered_secondary = [
            item for item in filtered_secondary if item.get("is_active", True)
        ]
        # Sort by order field
        filtered_secondary = sorted(filtered_secondary, key=lambda x: x.get("order", 0))
        template_config["secondary_menu_items"] = filtered_secondary

        return template_config

    def _filter_published_menu_items(self, menu_items, context):
        """Filter menu items based on hostname-aware page lookup and publication status"""
        from webpages.models import WebPage

        if not menu_items:
            return menu_items

        # Get hostname from request to find root page
        request = context.get("request")
        if not request:
            return menu_items

        hostname = request.get_host().lower()

        # Separate items into internal URLs and external/special URLs
        internal_urls = {}  # url -> [items]
        external_items = []

        for item in menu_items:
            url = item.get("url", "")

            # Keep external URLs, anchors, and special protocols
            if (
                "://" in url
                or url.startswith("#")
                or url.startswith("mailto:")
                or url.startswith("tel:")
                or not url
            ):
                external_items.append(item)
            elif url.startswith("/"):
                # Internal URL - add to lookup dict
                if url not in internal_urls:
                    internal_urls[url] = []
                internal_urls[url].append(item)
            else:
                external_items.append(item)

        if not internal_urls:
            return external_items

        # Single batch query using cached fields - ultra fast!
        published_pages = WebPage.objects.filter(
            cached_path__in=internal_urls.keys(),
            is_currently_published=True,  # Use cached publication status!
            is_deleted=False,
            cached_root_hostnames__contains=[hostname],  # Filter by hostname!
        )
        published_paths = set(published_pages.values_list("cached_path", flat=True))

        # Build result list
        result = list(external_items)
        for path, items in internal_urls.items():
            if path in published_paths:
                result.extend(items)

        return result
