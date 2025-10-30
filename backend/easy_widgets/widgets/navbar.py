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
    order: int = Field(0, description="Display order")


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
        # Sort by order field
        filtered_menu_items = sorted(
            filtered_menu_items, key=lambda x: x.get("order", 0)
        )
        template_config["menu_items"] = filtered_menu_items

        # Same for secondary menu items
        filtered_secondary = self._filter_published_menu_items(
            config.get("secondary_menu_items", []), context
        )
        # Sort by order field
        filtered_secondary = sorted(filtered_secondary, key=lambda x: x.get("order", 0))
        template_config["secondary_menu_items"] = filtered_secondary

        return template_config

    def _filter_published_menu_items(self, menu_items, context):
        """Filter menu items based on hostname-aware page lookup and publication status"""
        from webpages.models import WebPage, PageVersion
        from django.utils import timezone
        from django.db.models import Q, Exists, OuterRef

        if not menu_items:
            return menu_items

        # Get hostname from request to find root page
        request = context.get("request")
        if not request:
            return menu_items

        hostname = request.get_host().lower()

        # Get root page for this hostname
        root_page = WebPage.get_root_page_for_hostname(hostname)
        if not root_page:
            return menu_items

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

        # Normalize URLs to match cached_path format
        normalized_paths = {}
        for url, items in internal_urls.items():
            normalized = "/" + url.strip("/") + "/"
            normalized_paths[normalized] = items

        # Single batch query using cached_path - much faster!
        now = timezone.now()

        published_version_exists = PageVersion.objects.filter(
            page=OuterRef("pk"), effective_date__lte=now
        ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

        published_pages = (
            WebPage.objects.filter(cached_path__in=normalized_paths.keys())
            .annotate(has_published=Exists(published_version_exists))
            .filter(has_published=True)
        )

        published_paths = set(published_pages.values_list("cached_path", flat=True))
        print("published_paths", published_paths)
        print("internal_urls", internal_urls)
        # Build result list
        result = list(external_items)
        for path, items in normalized_paths.items():
            if path in published_paths:
                result.extend(items)

        return result
