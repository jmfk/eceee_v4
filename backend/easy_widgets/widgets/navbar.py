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
    mustache_template_name = "easy_widgets/widgets/navbar.mustache"

    widget_css = """
        /* Navbar Widget - Override only conflicting theme styles */
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
            color: #ffffff;
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
            width: 120px;
            padding: 2px 11px 3px;
            margin-top: 3px;
            box-shadow: inset -2px -2px 2px rgba(0, 0, 0, 0.2);
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

    def render_with_style(self, config, theme):
        """
        Render navbar with Mustache template (default or custom from theme).

        Args:
            config: Widget configuration (already prepared via prepare_template_context)
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) - always returns Mustache-rendered output
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            load_mustache_template,
        )

        style_name = config.get("component_style", "default")

        # Check if using custom theme component style
        if style_name and style_name != "default" and theme:
            styles = theme.component_styles or {}
            style = styles.get(style_name)

            if style:
                # Use theme's custom Mustache template
                template = style.get("template", "")
                css = style.get("css", "")

                # Prepare context for theme template
                context = {
                    **config,
                    **(style.get("variables", {})),
                }

                html = render_mustache(template, context)
                return html, css

        # Use default Mustache template
        try:
            template = load_mustache_template(self.mustache_template_name)
            html = render_mustache(template, config)
            return html, ""
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error rendering navbar with Mustache template: {e}")
            # Return None to fall back to Django template
            return None

    def prepare_template_context(self, config, context=None):
        """Prepare navbar menu items and background styling for Mustache template"""
        template_config = super().prepare_template_context(config, context)
        context_obj = DictToObj(context)

        # Get theme colors for CSS variable conversion
        theme = context.get("theme") if context else None
        theme_colors = theme.colors if theme and hasattr(theme, "colors") else {}

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

        # Convert color name to CSS variable if it's in theme colors
        if background_color and background_color in theme_colors:
            background_color = f"var(--{background_color})"

        if background_color:
            style_parts.append(f"background-color: {background_color};")

        # Add fixed styles
        # style_parts.append("box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);")
        # style_parts.append("height: 28px;")

        # Join all style parts with a space
        template_config["navbarStyle"] = " ".join(style_parts)

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
        template_config["widgetTypeCssClass"] = "navbar"

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
                bg_color = item.get("background_color")
                txt_color = item.get("text_color")
                bg_image = item.get("background_image")

                # Extract imgproxy_base_url if background_image is a dict
                if bg_image and isinstance(bg_image, dict):
                    bg_image = bg_image.get("imgproxy_base_url") or bg_image.get("url")

                # Convert color names to CSS variables
                if bg_color and bg_color in theme_colors:
                    bg_color = f"var(--{bg_color})"
                if txt_color and txt_color in theme_colors:
                    txt_color = f"var(--{txt_color})"

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
