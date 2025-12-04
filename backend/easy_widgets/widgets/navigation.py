"""
Navigation widget implementation.
"""

import json
from typing import Type, Optional, List, Literal, Union, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


def _parse_link_data(url_field: str) -> dict:
    """Parse url field as JSON to extract link data"""
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


class NavigationItem(BaseModel):
    """
    Navigation menu item with consolidated link data.

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
        return self._get_link_data().get("label", "")

    @property
    def is_active(self) -> bool:
        """Extract isActive from link data"""
        return self._get_link_data().get("isActive", True)

    @property
    def target_blank(self) -> bool:
        """Extract targetBlank from link data"""
        return self._get_link_data().get("targetBlank", False)

    @property
    def link_url(self) -> str:
        """Get the actual URL/href from link data"""
        data = self._get_link_data()
        link_type = data.get("type")
        if link_type == "internal":
            # For internal links, we need to resolve pageId to path
            # This is typically done in the template or render context
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

    def _get_link_data(self) -> dict:
        """Parse url field as JSON"""
        import json

        if not self.url:
            return {}
        if isinstance(self.url, str) and self.url.startswith("{"):
            try:
                return json.loads(self.url)
            except json.JSONDecodeError:
                return {}
        return {}

    def to_template_dict(self) -> dict:
        """Convert to dict for template rendering with resolved properties"""
        data = self._get_link_data()
        return {
            "label": data.get("label", ""),
            "url": self.link_url,
            "isActive": data.get("isActive", True),
            "targetBlank": data.get("targetBlank", False),
            "type": data.get("type", ""),
            "pageId": data.get("pageId"),
            "anchor": data.get("anchor"),
        }


# Update forward reference
NavigationItem.model_rebuild()


class NavigationConfig(BaseModel):
    """Configuration for Navigation widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menu_items: List[NavigationItem] = Field(
        default_factory=list,
        description="Navigation menu items",
        json_schema_extra={
            "hidden": True,  # Hidden from sidebar - use special editor instead
        },
    )

    navigation_style: Optional[str] = Field(
        None,
        description="Component style to use for rendering (from theme)",
        json_schema_extra={
            "component": "ComponentStyleSelect",
            "label": "Navigation Style",
            "description": "Select a component style from the theme",
        },
    )


@register_widget_type
class NavigationWidget(BaseWidget):
    """Navigation widget with background and text styling options"""

    name = "Navigation"
    description = "Navigation widget with background image/color and text color options"
    template_name = "easy_widgets/widgets/navigation.html"

    widget_css = """
    .navigation-widget .nav-container {
        display: flex;
        flex-direction: column;
        list-style: none;
        margin: 0 0 30px 0;
        padding: 0;
        gap: 10px;
        align-items: top;
        height: var(--nav-height, auto);
        width: 100%;
    }
    .navigation-widget .nav-container li {
        height: 24px;
        width: 100%;
    }
    .navigation-widget .nav-container a {
        color: inherit;
        text-decoration: none;
        transition: opacity 0.2s;
    }

    .navigation-widget .nav-container a:hover {
        opacity: 0.7;
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig

    def prepare_template_context(self, config, context=None):
        """
        Prepare navigation menu items based on configuration.
        """
        # Start with base config
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Process static menu_items (from LinkField JSON format)
        processed_menu_items = self._process_menu_items(
            config.get("menu_items", []), context
        )
        template_config["menu_items"] = processed_menu_items

        return template_config

    def _process_menu_items(self, menu_items, context):
        """
        Process menu items: extract link data, filter by publication status.

        Menu items now store consolidated link data in the url field as JSON:
        { type, pageId/url/..., label, isActive, targetBlank }
        """
        from webpages.models import WebPage

        if not menu_items:
            return []

        # Get request for hostname
        request = context.get("request") if context else None
        hostname = request.get_host().lower() if request else None

        # Process each item
        processed_items = []
        internal_page_ids = {}  # pageId -> [item_indices]

        for idx, item in enumerate(menu_items):
            url_field = item.get("url", "")
            link_data = _parse_link_data(url_field)

            # Skip inactive items
            if not link_data.get("isActive", True):
                continue

            processed = {
                "label": link_data.get("label", ""),
                "isActive": link_data.get("isActive", True),
                "targetBlank": link_data.get("targetBlank", False),
                "type": link_data.get("type", ""),
                "order": item.get("order", idx),
            }

            link_type = link_data.get("type")

            if link_type == "internal":
                page_id = link_data.get("pageId")
                if page_id:
                    if page_id not in internal_page_ids:
                        internal_page_ids[page_id] = []
                    internal_page_ids[page_id].append(len(processed_items))
                    processed["pageId"] = page_id
                    processed["anchor"] = link_data.get("anchor")
                    processed["url"] = ""
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

        # Batch lookup for internal pages
        if internal_page_ids:
            page_query = WebPage.objects.filter(
                id__in=internal_page_ids.keys(),
                is_deleted=False,
            )

            if hostname:
                page_query = page_query.filter(
                    is_currently_published=True,
                    cached_root_hostnames__contains=[hostname],
                )

            page_paths = {p.id: p.cached_path for p in page_query}

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

            # Filter out unresolved internal links
            processed_items = [
                item
                for idx, item in enumerate(processed_items)
                if idx in valid_indices or item.get("type") != "internal"
            ]

        # Sort by order
        return sorted(processed_items, key=lambda x: x.get("order", 0))

    def render_with_style(self, config, theme=None):
        """
        Render navigation using theme's component styles with Mustache templates.

        Args:
            config: Widget configuration (already prepared via prepare_template_context)
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None if no custom style
        """
        from webpages.utils.mustache_renderer import render_mustache

        # Get navigation style
        style_name = config.get("navigation_style")

        # Only render with custom style if a style is explicitly selected
        if not style_name or style_name == "default":
            return None

        # Get style from theme
        style = None
        if theme:
            styles = theme.component_styles or {}
            style = styles.get(style_name)

        # If style not found, return None to use default template
        if not style:
            return None

        # Get menu items
        menu_items = config.get("menu_items", [])

        if not menu_items:
            return None

        # Prepare context for Mustache rendering
        context = {
            "items": menu_items,
            "itemCount": len(menu_items),
            "hasItems": len(menu_items) > 0,
            # Style-specific variables
            **(style.get("variables") or {}),
        }

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
