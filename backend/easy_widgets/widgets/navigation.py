"""
Navigation widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from easy_widgets.models import LinkData


class NavigationItem(BaseModel):
    """
    Navigation menu item with link data.
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


class NavigationConfig(BaseModel):
    """Configuration for Navigation widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menu_items: List[NavigationItem] = Field(
        default_factory=list,
        description="Navigation menu items (static)",
        json_schema_extra={
            "hidden": True,  # Hidden from sidebar - use special editor instead
        },
    )

    include_subpages: bool = Field(
        False,
        description="Automatically include child pages as menu items",
        json_schema_extra={
            "component": "CheckboxInput",
            "order": 1,
        },
    )

    navigation_style: Optional[str] = Field(
        None,
        description="Component style to use for rendering (from theme)",
        json_schema_extra={
            "component": "ComponentStyleSelect",
            "label": "Navigation Style",
            "description": "Select a component style from the theme",
            "order": 2,
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

        Provides template variables:
        - items: Combined static and dynamic menu items
        - staticItems: Manually configured menu items
        - dynamicItems: Auto-generated items from child pages
        - itemCount: Total number of items
        - hasItems: Boolean indicating if any items exist
        """
        # Start with base config
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Process static menu_items (manually configured)
        static_items = self._process_menu_items(config.get("menu_items", []), context)

        # Generate dynamic items from child pages if enabled
        dynamic_items = []
        if config.get("include_subpages", False):
            dynamic_items = self._generate_subpage_items(context)

        # Combine static and dynamic items
        all_items = static_items + dynamic_items

        # Sort by order if present, otherwise maintain current order
        all_items = sorted(all_items, key=lambda x: x.get("order", 0))

        # Provide all template variables
        template_config["items"] = all_items
        template_config["staticItems"] = static_items
        template_config["dynamicItems"] = dynamic_items
        template_config["itemCount"] = len(all_items)
        template_config["hasItems"] = len(all_items) > 0

        # Legacy compatibility - keep menu_items for old templates
        template_config["menu_items"] = all_items

        return template_config

    def _generate_subpage_items(self, context):
        """
        Generate navigation items from child pages of the current page.

        Returns list of items with:
        - label: Page title
        - url: Page path
        - targetBlank: Always False
        - isActive: Always True
        - order: Based on page order
        """
        from webpages.models import WebPage

        # Get current page from context
        webpage_data = context.get("webpage_data") if context else None
        if not webpage_data:
            return []

        current_page_id = webpage_data.get("id")
        if not current_page_id:
            return []

        # Get hostname for filtering
        request = context.get("request") if context else None
        hostname = request.get_host().lower() if request else None

        # Query child pages
        child_pages = WebPage.objects.filter(
            parent_id=current_page_id,
            is_deleted=False,
        ).order_by("order", "id")

        # Filter by publication status and hostname if available
        if hostname:
            child_pages = child_pages.filter(
                is_currently_published=True,
                cached_root_hostnames__contains=[hostname],
            )

        # Convert to navigation items
        items = []
        for idx, page in enumerate(child_pages):
            items.append(
                {
                    "label": page.title or page.slug,
                    "url": page.cached_path or f"/{page.slug}",
                    "targetBlank": False,
                    "target_blank": False,  # Both formats for compatibility
                    "isActive": True,
                    "is_active": True,  # Both formats for compatibility
                    "type": "internal",
                    "order": page.order if page.order is not None else idx,
                }
            )

        return items

    def _process_menu_items(self, menu_items, context):
        """
        Process menu items: extract link data, filter by publication status.

        Handles both old format (dict with url field) and new format (NavigationItem with link_data).
        """
        from webpages.models import WebPage

        if not menu_items:
            return []

        # Get request for hostname
        request = context.get("request") if context else None
        hostname = request.get_host().lower() if request else None

        # Process each item
        processed_items = []
        internal_page_ids = {}  # page_id -> [item_indices]

        for idx, item in enumerate(menu_items):
            # Only support new format: {'link_data': {...}, 'order': 0}
            link_data_dict = item.get("link_data")
            # print("link_data_dict", link_data_dict)
            # print("item", item)
            # print("idx", idx)
            if not link_data_dict:
                # Skip items without link_data field
                continue

            try:
                link_data = LinkData(**link_data_dict)
            except Exception:
                # Skip items that can't be parsed as LinkData
                continue

            # Skip inactive items
            if not link_data.is_active:
                continue

            order = item.get("order", idx)

            processed = {
                "label": link_data.label,
                "is_active": link_data.is_active,
                "target_blank": link_data.target_blank,
                "type": link_data.type,
                "order": order,
            }

            if link_data.type == "internal":
                if link_data.page_id:
                    # Mark for batch lookup by ID
                    if link_data.page_id not in internal_page_ids:
                        internal_page_ids[link_data.page_id] = []
                    internal_page_ids[link_data.page_id].append(len(processed_items))
                    processed["page_id"] = link_data.page_id
                    processed["anchor"] = link_data.anchor
                    processed["url"] = ""
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
            )

            if hostname:
                page_query = page_query.filter(
                    is_currently_published=True,
                    cached_root_hostnames__contains=[hostname],
                )

            page_paths = {p.id: p.cached_path for p in page_query}

            # Update processed items with resolved paths
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

        # print("processed_items", processed_items)
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

        # Get all menu item collections
        all_items = config.get("items", [])
        static_items = config.get("staticItems", [])
        dynamic_items = config.get("dynamicItems", [])

        # Prepare context for Mustache rendering with all required variables
        context = {
            "items": all_items,
            "staticItems": static_items,
            "dynamicItems": dynamic_items,
            "itemCount": config.get("itemCount", 0),
            "hasItems": config.get("hasItems", False),
            # Style-specific variables
            **(style.get("variables") or {}),
        }

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
