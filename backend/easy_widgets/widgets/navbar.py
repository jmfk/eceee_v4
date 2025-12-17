"""
Navbar widget implementation.
"""

from typing import Type, List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from file_manager.imgproxy import imgproxy_service
from utils.dict_utils import DictToObj
from easy_widgets.models import LinkData


class NavbarItem(BaseModel):
    """
    Navbar menu item with link data.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    link_data: LinkData = Field(
        ...,
        description="Menu item link data",
    )
    order: int = Field(0, description="Display order")


class SecondaryMenuItem(BaseModel):
    """
    Secondary navbar menu item with custom styling.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    link_data: LinkData = Field(
        ...,
        description="Menu item link data",
    )
    background_color: Optional[str] = Field(
        None,
        description="Individual background color (hex or CSS color)",
        json_schema_extra={"component": "ColorInput"},
    )
    text_color: Optional[str] = Field(
        None,
        description="Individual text color (hex or CSS color)",
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
            "hidden": True,  # Hidden from sidebar - use special editor instead
        },
    )
    secondary_menu_items: List[SecondaryMenuItem] = Field(
        default_factory=list,
        description="Secondary navbar menu items (right-aligned, with custom colors)",
        json_schema_extra={
            "hidden": True,  # Hidden from sidebar - use special editor instead
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
    mustache_template_name = "easy_widgets/widgets/navbar.mustache"

    layout_parts = {
        "navbar-widget": {
            "label": "Navbar widget container",
            "selector": ".navbar-widget",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
                "backgroundImage",  # Composite property includes size, position, repeat, and aspect-ratio
                "color",
            ],
        },
    }

    widget_css = """
        /* Navbar Widget - Styling from design groups */
        .widget-type-navbar {
            background-color: var(--navbar-bg-color-xs, #3b82f6);
            color: var(--navbar-text-color-xs, #ffffff);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }

        @media (min-width: 640px) {
            .widget-type-navbar {
                background-color: var(--navbar-bg-color-sm, var(--navbar-bg-color-xs, #3b82f6));
                color: var(--navbar-text-color-sm, var(--navbar-text-color-xs, #ffffff));
            }
        }

        @media (min-width: 768px) {
            .widget-type-navbar {
                background-color: var(--navbar-bg-color-md, var(--navbar-bg-color-sm, #3b82f6));
                color: var(--navbar-text-color-md, var(--navbar-text-color-sm, #ffffff));
            }
        }

        @media (min-width: 1024px) {
            .widget-type-navbar {
                background-color: var(--navbar-bg-color-lg, #3b82f6);
                color: var(--navbar-text-color-lg, #ffffff);
            }
        }

        @media (min-width: 1280px) {
            .widget-type-navbar {
                background-color: var(--navbar-bg-color-xl, #3b82f6);
                color: var(--navbar-text-color-xl, #ffffff);
            }
        }

        /* Navbar Menu Styling */
        .navbar-menu-list {
            list-style: none !important;
            font-size: 16px;
            margin-top: 0px;
            font-family: "Source Sans 3", sans-serif;
            font-weight: 300;
            line-height: 22px;
            margin-bottom: 0;          
        }

        .navbar-menu-item {
            list-style: none !important;
            font-size: 14px;
            margin-top: 0px;
            font-family: "Source Sans 3", sans-serif;
            font-weight: 300;
            line-height: 22px;
            margin-bottom: 0px;            
        }

        .navbar-menu-item  a {
            font-size: 14px;
            color: inherit;
            font-family: "Source Sans 3", sans-serif;
            font-weight: 500;
        }
        
        .navbar-secondary-menu {
            display: flex;
            gap: 0;
            list-style: none;
            margin: 0;
            padding: 0;
            align-items: flex-end;
        }
        
        .navbar-secondary-menu .navbar-menu-item {
            text-align: left;
            width: 140px;
            padding: 2px 11px 2px;
            margin-top: 2px;
            box-shadow: inset -1px -1px 1px rgba(0, 0, 0, 0.2);
        }
        
        .navbar-secondary-menu .navbar-menu-item a {
            border-radius: 0 0 0 0;
        }

        .navbar-link {
            text-decoration: none !important;
        }
        """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavbarConfig

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items for Mustache template (styling from design groups)"""
        template_config = super().prepare_template_context(config, context)

        # Process and filter menu items
        processed_menu_items = self._process_menu_items(
            config.get("menu_items", []), context
        )
        template_config["menuItems"] = processed_menu_items

        # Same for secondary menu items
        processed_secondary = self._process_menu_items(
            config.get("secondary_menu_items", []), context, is_secondary=True
        )
        template_config["secondaryMenuItems"] = processed_secondary
        template_config["hasSecondaryMenuItems"] = len(processed_secondary) > 0

        # Add hamburger breakpoint
        template_config["hamburgerBreakpoint"] = config.get("hamburger_breakpoint", 768)

        # Add widget type CSS class
        template_config["widgetTypeCssClass"] = self.css_class_name

        # No inline styles - all styling from design groups CSS variables
        template_config["navbarStyle"] = ""

        return template_config

    def _process_menu_items(self, menu_items, context, is_secondary=False):
        """
        Process menu items: extract link data, filter by publication status, sort.
        """
        from webpages.models import WebPage

        if not menu_items:
            return []

        # Get hostname from request
        request = context.get("request") if context else None
        hostname = request.get_host().lower() if request else None

        # Get theme colors for CSS variable conversion
        theme = context.get("theme") if context else None
        theme_colors = theme.colors if theme and hasattr(theme, "colors") else {}

        # Process each item to extract link data
        processed_items = []
        internal_page_ids = {}  # page_id -> [item_indices]

        for idx, item in enumerate(menu_items):
            link_data = LinkData(**item.get("link_data"))

            # Skip inactive items
            if not link_data.is_active:
                continue

            order = item.get("order", idx)

            # Build processed item with extracted data (camelCase for Mustache)
            processed = {
                "label": link_data.label,
                "isActive": link_data.is_active,
                "targetBlank": link_data.target_blank,
                "type": link_data.type,
                "order": order,
                "pageTitle": link_data.page_title,  # For title attribute
            }

            # Add secondary item extra fields
            if is_secondary:
                from webpages.utils.color_utils import resolve_color_value

                bg_color = item.get("background_color")
                txt_color = item.get("text_color")
                bg_image = item.get("background_image")

                # Extract imgproxy_base_url if background_image is a dict
                if bg_image and isinstance(bg_image, dict):
                    bg_image = bg_image.get("imgproxy_base_url") or bg_image.get("url")

                # Convert color names to CSS variables
                bg_color = resolve_color_value(bg_color, theme_colors)
                txt_color = resolve_color_value(txt_color, theme_colors)

                processed["backgroundColor"] = bg_color
                processed["textColor"] = txt_color
                processed["backgroundImage"] = bg_image

            if link_data.type == "internal":
                if link_data.page_id:
                    # Mark for batch lookup by ID
                    if link_data.page_id not in internal_page_ids:
                        internal_page_ids[link_data.page_id] = []
                    internal_page_ids[link_data.page_id].append(len(processed_items))
                    processed["page_id"] = link_data.page_id
                    processed["anchor"] = link_data.anchor
                    processed["url"] = ""  # Will be resolved after batch lookup
                    processed_items.append(processed)
            elif link_data.type == "external":
                processed["url"] = link_data.url or ""
                processed_items.append(processed)
            elif link_data.type == "email":
                processed["url"] = f"mailto:{link_data.address or ''}"
                processed_items.append(processed)
            elif link_data.type == "phone":
                processed["url"] = f"tel:{link_data.number or ''}"
                processed_items.append(processed)
            elif link_data.type == "anchor":
                processed["url"] = f"#{link_data.anchor or ''}"
                processed_items.append(processed)

        # Batch lookup for internal pages
        valid_indices = set()

        if internal_page_ids:
            page_query = WebPage.objects.filter(
                id__in=internal_page_ids.keys(),
                is_deleted=False,
                is_currently_published=True,
            ).values("id", "cached_path", "cached_root_hostnames")

            # Build lookup with hostname info
            page_data = {
                p["id"]: {
                    "path": p["cached_path"],
                    "hostnames": p["cached_root_hostnames"],
                }
                for p in page_query
            }

            # Update processed items with resolved paths
            for page_id, indices in internal_page_ids.items():
                data = page_data.get(page_id)
                if data:
                    path = data["path"]
                    target_hostnames = data["hostnames"]

                    # Check if target page is on different hostname
                    url = path
                    if target_hostnames and hostname:
                        target_hostname = target_hostnames[0]
                        if target_hostname.lower() != hostname.lower():
                            # Build absolute URL with protocol
                            if target_hostname.startswith(("localhost", "127.0.0.1")):
                                protocol = "http"
                            else:
                                protocol = "https"
                            url = f"{protocol}://{target_hostname}{path}"

                    for idx in indices:
                        anchor = processed_items[idx].get("anchor")
                        processed_items[idx]["url"] = (
                            f"{url}#{anchor}" if anchor else url
                        )
                        valid_indices.add(idx)

            # Filter out items with unresolved internal links
            processed_items = [
                item
                for idx, item in enumerate(processed_items)
                if idx in valid_indices or item.get("type") != "internal"
            ]

        # Sort by order
        processed_items = sorted(processed_items, key=lambda x: x.get("order", 0))

        return processed_items
