"""
Navbar widget implementation.
"""

from typing import Type, List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from file_manager.imgproxy import imgproxy_service
from utils.dict_utils import DictToObj


def _parse_link_data(url_field: str) -> dict:
    """Parse url field as JSON to extract link data"""
    import json

    if not url_field:
        return {}
    if isinstance(url_field, str) and url_field.startswith("{"):
        try:
            return json.loads(url_field)
        except json.JSONDecodeError:
            return {}
    return {}


def _get_link_url(data: dict) -> str:
    """Get the actual URL/href from link data"""
    link_type = data.get("type")
    if link_type == "internal":
        # For internal links, pageId needs to be resolved to path
        return data.get("pageId", "")
    elif link_type == "external":
        return data.get("url", "")
    elif link_type == "email":
        return f"mailto:{data.get('address', '')}"
    elif link_type == "phone":
        return f"tel:{data.get('number', '')}"
    elif link_type == "anchor":
        return f"#{data.get('anchor', '')}"
    return ""


class NavbarItem(BaseModel):
    """
    Navbar menu item with consolidated link data.

    The url field stores a JSON object containing:
    - type: 'internal' | 'external' | 'email' | 'phone' | 'anchor'
    - pageId/url/address/number/anchor: target reference
    - label: display text
    - isActive: whether item is visible
    - targetBlank: whether to open in new tab
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Allow both snake_case and camelCase
    )

    url: str = Field(
        ...,
        description="Menu item link data (JSON with type, target, label, isActive, targetBlank)",
        json_schema_extra={"component": "LinkField"},
    )
    order: int = Field(0, description="Display order")

    @property
    def label(self) -> str:
        """Extract label from link data"""
        return _parse_link_data(self.url).get("label", "")

    @property
    def is_active(self) -> bool:
        """Extract isActive from link data"""
        return _parse_link_data(self.url).get("isActive", True)

    @property
    def target_blank(self) -> bool:
        """Extract targetBlank from link data"""
        return _parse_link_data(self.url).get("targetBlank", False)

    @property
    def link_url(self) -> str:
        """Get the actual URL/href from link data"""
        return _get_link_url(_parse_link_data(self.url))

    def to_template_dict(self) -> dict:
        """Convert to dict for template rendering with resolved properties"""
        data = _parse_link_data(self.url)
        return {
            "label": data.get("label", ""),
            "url": _get_link_url(data),
            "isActive": data.get("isActive", True),
            "targetBlank": data.get("targetBlank", False),
            "type": data.get("type", ""),
            "pageId": data.get("pageId"),
            "anchor": data.get("anchor"),
        }


class SecondaryMenuItem(BaseModel):
    """
    Secondary navbar menu item with custom styling.

    The url field stores consolidated link data (same as NavbarItem).
    Additional fields for styling are kept separate.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    url: str = Field(
        ...,
        description="Menu item link data (JSON with type, target, label, isActive, targetBlank)",
        json_schema_extra={"component": "LinkField"},
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

    @property
    def label(self) -> str:
        """Extract label from link data"""
        return _parse_link_data(self.url).get("label", "")

    @property
    def is_active(self) -> bool:
        """Extract isActive from link data"""
        return _parse_link_data(self.url).get("isActive", True)

    @property
    def target_blank(self) -> bool:
        """Extract targetBlank from link data"""
        return _parse_link_data(self.url).get("targetBlank", False)

    @property
    def link_url(self) -> str:
        """Get the actual URL/href from link data"""
        return _get_link_url(_parse_link_data(self.url))

    def to_template_dict(self) -> dict:
        """Convert to dict for template rendering with resolved properties"""
        data = _parse_link_data(self.url)
        return {
            "label": data.get("label", ""),
            "url": _get_link_url(data),
            "isActive": data.get("isActive", True),
            "targetBlank": data.get("targetBlank", False),
            "type": data.get("type", ""),
            "pageId": data.get("pageId"),
            "anchor": data.get("anchor"),
            "backgroundColor": self.background_color,
            "textColor": self.text_color,
            "backgroundImage": self.background_image,
        }


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
            font-size: 16px;
            margin-top: 0px;
            font-family: "Source Sans 3", sans-serif;
            font-weight: 300;
            line-height: 22px;
            margin-bottom: 0px;            
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
        Render navbar with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )
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
        navbar_html = render_to_string(self.template_name, {"config": prepared_config})

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

        # Process and filter menu items
        processed_menu_items = self._process_menu_items(
            config.get("menu_items", []), context
        )
        template_config["menu_items"] = processed_menu_items

        # Same for secondary menu items
        processed_secondary = self._process_menu_items(
            config.get("secondary_menu_items", []), context, is_secondary=True
        )
        template_config["secondary_menu_items"] = processed_secondary

        return template_config

    def _process_menu_items(self, menu_items, context, is_secondary=False):
        """
        Process menu items: extract link data, filter by publication status, sort.

        Menu items now store consolidated link data in the url field as JSON:
        { type, pageId/url/..., label, isActive, targetBlank }
        """
        from webpages.models import WebPage

        if not menu_items:
            return []

        # Get hostname from request
        request = context.get("request") if context else None
        hostname = request.get_host().lower() if request else None

        # Process each item to extract link data
        processed_items = []
        internal_page_ids = {}  # pageId -> [item_indices]

        for idx, item in enumerate(menu_items):
            url_field = item.get("url", "")
            link_data = _parse_link_data(url_field)

            # Skip inactive items
            if not link_data.get("isActive", True):
                continue

            # Build processed item with extracted data
            processed = {
                "label": link_data.get("label", ""),
                "isActive": link_data.get("isActive", True),
                "targetBlank": link_data.get("targetBlank", False),
                "type": link_data.get("type", ""),
                "order": item.get("order", idx),
            }

            # Add secondary item extra fields
            if is_secondary:
                processed["backgroundColor"] = item.get("background_color") or item.get(
                    "backgroundColor"
                )
                processed["textColor"] = item.get("text_color") or item.get("textColor")
                processed["backgroundImage"] = item.get("background_image") or item.get(
                    "backgroundImage"
                )

            link_type = link_data.get("type")

            if link_type == "internal":
                page_id = link_data.get("pageId")
                if page_id:
                    # Mark for batch lookup
                    if page_id not in internal_page_ids:
                        internal_page_ids[page_id] = []
                    internal_page_ids[page_id].append(len(processed_items))
                    processed["pageId"] = page_id
                    processed["anchor"] = link_data.get("anchor")
                    processed["url"] = ""  # Will be resolved after batch lookup
                    processed_items.append(processed)
            elif link_type == "external":
                processed["url"] = link_data.get("url", "")
                processed_items.append(processed)
            elif link_type == "email":
                processed["url"] = f"mailto:{link_data.get('address', '')}"
                processed_items.append(processed)
            elif link_type == "phone":
                processed["url"] = f"tel:{link_data.get('number', '')}"
                processed_items.append(processed)
            elif link_type == "anchor":
                processed["url"] = f"#{link_data.get('anchor', '')}"
                processed_items.append(processed)
            elif not link_type:
                # Legacy or empty item - skip or handle
                pass

        # Batch lookup for internal pages
        if internal_page_ids:
            page_query = WebPage.objects.filter(
                id__in=internal_page_ids.keys(),
                is_deleted=False,
            )

            # Filter by publication status and hostname if available
            if hostname:
                page_query = page_query.filter(
                    is_currently_published=True,
                    cached_root_hostnames__contains=[hostname],
                )

            # Build lookup of id -> path
            page_paths = {p.id: p.cached_path for p in page_query}

            # Update processed items with resolved paths
            valid_indices = set()
            for page_id, indices in internal_page_ids.items():
                path = page_paths.get(page_id)
                if path:
                    for idx in indices:
                        anchor = processed_items[idx].get("anchor")
                        processed_items[idx]["url"] = (
                            f"{path}#{anchor}" if anchor else path
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
