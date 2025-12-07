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
    mustache_template_name = "easy_widgets/widgets/navigation.mustache"

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
        Prepare navigation menu items based on configuration for Mustache template.

        Provides template variables (camelCase for Mustache):
        - items: Combined static and dynamic menu items
        - staticItems: Manually configured menu items
        - dynamicItems: Auto-generated items from child pages
        - itemCount: Total number of items
        - hasItems: Boolean indicating if any items exist
        - Page hierarchy: currentPage, currentChildren, parentPage, etc.
        - Inheritance: isInherited, inheritanceDepth, depth helpers
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

        # Provide all template variables (camelCase for Mustache)
        template_config["items"] = all_items
        template_config["staticItems"] = static_items
        template_config["dynamicItems"] = dynamic_items
        template_config["itemCount"] = len(all_items)
        template_config["hasItems"] = len(all_items) > 0
        template_config["staticItemCount"] = len(static_items)
        template_config["hasStaticItems"] = len(static_items) > 0
        template_config["dynamicItemCount"] = len(dynamic_items)
        template_config["hasDynamicItems"] = len(dynamic_items) > 0

        # Add widget type CSS class
        template_config["widgetTypeCssClass"] = "navigation"

        # Add nav container height
        template_config["navContainerHeight"] = config.get(
            "nav_container_height", "auto"
        )

        # Add page hierarchy context for component style templates
        hierarchy_context = self._get_page_hierarchy_context(context)
        template_config.update(hierarchy_context)

        return template_config

    def _get_page_hierarchy_context(self, context):
        """
        Get page hierarchy context variables for Mustache templates.

        Provides variables matching frontend prepareNavigationContext():
        - currentPage, currentChildren, hasCurrentChildren
        - parentPage, parentChildren, hasParentChildren
        - isInherited, inheritanceDepth, depth helpers

        Args:
            context: Rendering context with webpage_data, parent, inherited_from

        Returns:
            dict: Page hierarchy context for Mustache template
        """
        from webpages.models import WebPage

        # Get current page data
        webpage_data = context.get("webpage_data") or {}
        current_page_id = webpage_data.get("id")
        # Serialize current page for template
        current_page = {
            "id": webpage_data.get("id"),
            "title": webpage_data.get("title"),
            "short_title": webpage_data.get("short_title"),
            "label": webpage_data.get("short_title") or webpage_data.get("title"),
            "slug": webpage_data.get("slug"),
            "path": webpage_data.get("path") or webpage_data.get("cached_path"),
        }

        # Get hostname for filtering
        request = context.get("request")
        hostname = request.get_host().lower() if request else None

        # Query current page children
        current_children = []
        if current_page_id:
            child_query = (
                WebPage.objects.filter(
                    parent_id=current_page_id,
                    is_deleted=False,
                )
                .select_related("latest_version")
                .order_by("sort_order", "id")
            )

            if hostname:
                child_query = child_query.filter(
                    is_currently_published=True,
                    cached_root_hostnames__contains=[hostname],
                )

            for page in child_query:
                # Try to get shortTitle from page_data
                title = page.title
                if page.latest_version and page.latest_version.page_data:
                    page_data = page.latest_version.page_data
                    short_title = page_data.get("shortTitle") or page_data.get(
                        "short_title"
                    )
                    # Guard against responsive breakpoint objects
                    if short_title and isinstance(short_title, str):
                        title = short_title
                current_children.append(
                    {
                        "id": page.id,
                        "title": page.title,  # Keep original title
                        "label": title,  # Short title or title for display
                        "slug": page.slug,
                        "path": page.cached_path or f"/{page.slug}",
                    }
                )

        # Get parent page data
        parent = context.get("parent")
        parent_page = {}
        parent_children = []

        if parent:
            # Try to get shortTitle from parent's page_data
            parent_label = parent.title
            if (
                hasattr(parent, "latest_version")
                and parent.latest_version
                and parent.latest_version.page_data
            ):
                page_data = parent.latest_version.page_data
                short_title = page_data.get("short_title")
                # Guard against responsive breakpoint objects
                if short_title and isinstance(short_title, str):
                    parent_label = short_title

            parent_page = {
                "id": parent.id,
                "title": parent.title,
                "label": parent_label,
                "slug": parent.slug,
                "path": parent.cached_path or f"/{parent.slug}",
            }

            # Query parent's children (siblings of current page)
            parent_child_query = (
                WebPage.objects.filter(
                    parent_id=parent.id,
                    is_deleted=False,
                )
                .select_related("latest_version")
                .order_by("sort_order", "id")
            )

            if hostname:
                parent_child_query = parent_child_query.filter(
                    is_currently_published=True,
                    cached_root_hostnames__contains=[hostname],
                )

            for page in parent_child_query:
                # Try to get shortTitle from page_data
                title = page.title
                if page.latest_version and page.latest_version.page_data:
                    page_data = page.latest_version.page_data
                    short_title = page_data.get("short_title")
                    # Guard against responsive breakpoint objects
                    if short_title and isinstance(short_title, str):
                        title = short_title

                parent_children.append(
                    {
                        "id": page.id,
                        "title": page.title,  # Keep original title
                        "label": title,  # Short title or title for display
                        "slug": page.slug,
                        "path": page.cached_path or f"/{page.slug}",
                    }
                )

        # Check inheritance context
        # The renderer adds this as 'widget_inherited_from' in enhanced_context
        inherited_from = context.get("widget_inherited_from") or context.get(
            "inherited_from"
        )
        is_inherited = bool(inherited_from)

        # Calculate inheritance depth from webpage_data
        # Depth represents how deep the current page is in the hierarchy
        # 0 = root page, 1 = first level child, 2 = second level child, etc.
        depth = webpage_data.get("depth", 0)

        return {
            # Page context (camelCase for Mustache)
            "currentPage": current_page,
            "currentChildren": current_children,
            "hasCurrentChildren": len(current_children) > 0,
            "currentChildrenCount": len(current_children),
            "dynamicItems": current_children,
            "hasDynamicItems": len(current_children) > 0,
            "dynamicItemCount": len(current_children),
            "parentPage": parent_page,
            "parentChildren": parent_children,
            "hasParentChildren": len(parent_children) > 0,
            "parentChildrenCount": len(parent_children),
            # Inheritance context
            "isInherited": is_inherited,
            "inheritanceDepth": depth,
            # Depth helpers for Mustache conditionals
            "isRoot": depth == 0,
            "isLevel1": depth == 1,
            "isLevel2": depth == 2,
            "isLevel3": depth == 3,
            "isLevel1AndBelow": depth >= 1,
            "isLevel2AndBelow": depth >= 2,
            "isLevel3AndBelow": depth >= 3,
            "isDeepLevel": depth >= 4,
        }

    def _generate_subpage_items(self, context):
        """
        Generate navigation items from child pages of the current page.

        Returns list of items with:
        - label: Short title if available, otherwise page title
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

        # Query child pages with their latest versions to get page_data
        child_pages = (
            WebPage.objects.filter(
                parent_id=current_page_id,
                is_deleted=False,
            )
            .select_related("latest_version")
            .order_by("sort_order", "id")
        )

        # Filter by publication status and hostname if available
        if hostname:
            child_pages = child_pages.filter(
                is_currently_published=True,
                cached_root_hostnames__contains=[hostname],
            )

        # Convert to navigation items
        items = []
        for idx, page in enumerate(child_pages):
            # Try to get shortTitle from page_data, fallback to title
            label = page.title
            if page.latest_version and page.latest_version.page_data:
                page_data = page.latest_version.page_data
                short_title = page_data.get("short_title")
                # Guard against responsive breakpoint objects
                if short_title and isinstance(short_title, str):
                    label = short_title

            items.append(
                {
                    "label": label or page.slug,
                    "url": page.cached_path or f"/{page.slug}",
                    "targetBlank": False,
                    "isActive": True,
                    "type": "internal",
                    "order": page.sort_order if page.sort_order is not None else idx,
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

            # Use camelCase for Mustache templates
            processed = {
                "label": link_data.label,
                "isActive": link_data.is_active,
                "targetBlank": link_data.target_blank,
                "type": link_data.type,
                "order": order,
                "pageTitle": link_data.page_title,  # For title attribute
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

        # Sort by order
        return sorted(processed_items, key=lambda x: x.get("order", 0))

    def render_with_style(self, config, theme=None):
        """
        Render navigation using Mustache template (default or custom from theme).

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

        # Get navigation style
        style_name = config.get("navigation_style")

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
            logger.error(f"Error rendering navigation with Mustache template: {e}")
            # Return None to fall back to Django template
            return None
