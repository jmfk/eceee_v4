"""
Backend page and widget rendering system
"""

from django.template.loader import get_template
from django.template import Context
from django.utils.safestring import mark_safe


class WebPageRenderer:
    """
    Comprehensive backend renderer for WebPage instances.
    Renders complete HTML pages including layout, widgets, theme, and CSS.
    """

    def __init__(self, request=None):
        self.request = request
        self._rendered_css = set()  # Track rendered CSS to avoid duplicates

    def render(self, page, version=None, context=None):
        """
        Render a complete WebPage to HTML string.

        Args:
            page: WebPage instance to render
            version: Optional specific PageVersion to render (defaults to latest published)
            context: Optional additional template context

        Returns:
            dict: Contains 'html', 'css', 'meta', and 'debug_info'
        """
        from django.template.loader import render_to_string
        from django.template import Context, Template

        # Get the appropriate version
        page_version = version or page.get_latest_published_version()
        if not page_version:
            raise ValueError(f"No published version found for page: {page.title}")

        # Build base context
        render_context = self._build_base_context(page, page_version, context)

        # Get effective layout
        effective_layout = page.get_effective_layout()
        if not effective_layout:
            raise ValueError(f"No layout found for page: {page.title}")

        # Render widgets by slot
        widgets_by_slot = self._render_widgets_by_slot(
            page, page_version, render_context
        )
        render_context["widgets_by_slot"] = widgets_by_slot

        # Get layout template name
        template_name = self._get_layout_template_name(effective_layout)

        # Render the page HTML
        page_html = render_to_string(
            template_name, render_context, request=self.request
        )

        # Collect CSS
        page_css = self._collect_page_css(page, effective_layout, widgets_by_slot)

        # Generate meta tags
        meta_tags = self._generate_meta_tags(page)

        return {
            "html": page_html,
            "css": page_css,
            "meta": meta_tags,
            "debug_info": self._generate_debug_info(
                page, page_version, effective_layout
            ),
        }

    def render_widget_json(self, widget_data, context=None, slot_dimensions=None):
        """
        Render a widget from JSON data (as stored in PageVersion.widgets).

        Args:
            widget_data: Widget JSON data from PageVersion
            context: Optional template context
            slot_dimensions: Optional dimensions for the slot this widget is in
                Format: {"mobile": {"width": 360, "height": None}, ...}

        Returns:
            str: Rendered widget HTML
        """
        from django.template.loader import render_to_string
        from .widget_registry import widget_type_registry

        # Get widget type from registry - support both old and new formats
        widget_type_name = widget_data.get("widget_type") or widget_data.get("type")
        widget_type = (
            widget_type_registry.get_widget_type_flexible(widget_type_name)
            if widget_type_name
            else None
        )

        if not widget_type:
            return f'<!-- Widget type "{widget_type_name}" not found -->'

        # Get base configuration
        base_config = widget_data.get("config", {})

        # Enhanced context with dimensions
        enhanced_context = dict(context or {})
        if slot_dimensions:
            enhanced_context["_widget_dimensions"] = slot_dimensions

        # Prepare template context with widget-specific logic (e.g., collection resolution)
        # All widgets now have prepare_template_context (default implementation in BaseWidget)
        template_config = base_config
        try:
            template_config = widget_type.prepare_template_context(
                base_config, enhanced_context
            )
        except Exception as e:
            # Log error but continue with base config to prevent crashes
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                f"Error preparing template context for {widget_type.name}: {e}"
            )

        # Create a mock widget object for template rendering
        class MockWidget:
            def __init__(self, widget_type, configuration, widget_data):
                self.id = widget_data.get("id", "unknown")
                self.widget_type = widget_type
                self.widget_data = widget_data
                self.config = template_config
                self.sort_order = widget_data.get("sort_order", 0)
                self.is_visible = widget_data.get("is_visible", True)

        mock_widget = MockWidget(widget_type, template_config, widget_data)

        slot_name = context.get("slot_name", "")
        layout_name = context.get("layout_name", "")
        theme = context.get("theme", "") or context.get("theme_name", "")

        # Split template_name into base and extension
        template_name = widget_type.template_name
        base_name, ext = (
            template_name.rsplit(".", 1)
            if "." in template_name
            else (template_name, "html")
        )

        # Build list of template names to try (in order of specificity)
        template_names = []

        # Most specific: theme + layout + slot
        if theme and layout_name and slot_name:
            template_names.append(
                f"{base_name}_{theme}_{layout_name}_{slot_name}.{ext}"
            )

        # Layout + slot specific
        if layout_name and slot_name:
            template_names.append(f"{base_name}_{layout_name}_{slot_name}.{ext}")

        # Layout specific
        if layout_name:
            template_names.append(f"{base_name}_{layout_name}.{ext}")

        # Slot specific
        if slot_name:
            template_names.append(f"{base_name}_{slot_name}.{ext}")

        # Default fallback
        template_names.append(template_name)

        # Render using the widget's template
        try:
            widget_html = render_to_string(
                template_names,
                {
                    "widget": mock_widget,
                    "config": template_config,
                    "widget_id": widget_data.get("id", "unknown"),
                    "widget_type": widget_type,
                    "widget_data": widget_data,  # Full widget data access
                    **enhanced_context,
                },
                request=self.request,
            )
            return widget_html
        except Exception as e:
            return f"<!-- Error rendering widget: {e} -->"

    def _build_base_context(self, page, page_version, extra_context=None):
        """Build the base template context for page rendering."""
        context = {
            "page": page,
            "current_page": page,
            "page_version": page_version,
            "page_data": page_version.page_data,
            "version_number": page_version.version_number,
            "publication_status": page_version.get_publication_status(),
            "is_current_published": page_version.is_current_published(),
            "effective_date": page_version.effective_date,
            "created_by": page_version.created_by,
            "layout": page.get_effective_layout(),
            "theme": page.get_effective_theme(),
            "parent": page.parent,
            "request": self.request,
        }

        # Add effective layout slots
        effective_layout = page.get_effective_layout()
        if effective_layout and hasattr(effective_layout, "slot_configuration"):
            context["slots"] = effective_layout.slot_configuration.get("slots", [])
        else:
            context["slots"] = []

        # Check if this is an object page (based on linked object fields if they exist)
        is_object_page = (
            hasattr(page, "linked_object_type")
            and hasattr(page, "linked_object_id")
            and page.linked_object_type
            and page.linked_object_id
        )

        if is_object_page:
            # Add object context for object pages
            context["is_object_page"] = True
            context["linked_object"] = {
                "type": page.linked_object_type,
                "id": page.linked_object_id,
            }

            # Try to get object content if the method exists
            if hasattr(page, "get_object_content"):
                try:
                    context["object_content"] = page.get_object_content()
                except Exception:
                    context["object_content"] = None

            # For objects, ensure there's at least a "main" slot available
            slot_names = [slot.get("name") for slot in context["slots"]]
            if "main" not in slot_names:
                context["slots"].append(
                    {
                        "name": "main",
                        "title": "Main Content",
                        "description": "Primary content area for object display",
                        "max_widgets": 10,
                        "is_default_object_slot": True,
                    }
                )
        else:
            context["is_object_page"] = False

        # Merge additional context
        if extra_context:
            context.update(extra_context)

        return context

    def _render_widgets_by_slot(self, page, page_version, context):
        """Render widgets organized by slot with parent slot inheritance for empty slots."""
        widgets_by_slot = {}

        # Get widget inheritance info
        widgets_info = page.get_widgets_inheritance_info()

        # Get all available slots from the layout
        layout_slots = context.get("slots", [])
        layout_slot_names = [
            slot.get("name") for slot in layout_slots if slot.get("name")
        ]

        # Build a map of slot names to their dimension configurations
        slot_dimensions_map = {}
        for slot in layout_slots:
            slot_name = slot.get("name")
            if slot_name and "dimensions" in slot:
                slot_dimensions_map[slot_name] = slot.get("dimensions")

        # Process each slot from the inheritance info
        for slot_name, slot_info in widgets_info.items():
            rendered_widgets = []

            # Get dimensions for this slot
            slot_dimensions = slot_dimensions_map.get(slot_name)

            for widget_info in slot_info.get("widgets", []):
                widget_data = widget_info["widget"]
                context["layout_name"] = context["layout"].name
                context["slot_name"] = slot_name

                # Render the widget with slot dimensions
                widget_html = self.render_widget_json(
                    widget_data, context, slot_dimensions=slot_dimensions
                )
                rendered_widgets.append(
                    {
                        "html": widget_html,
                        "widget_data": widget_data,
                        "inherited_from": widget_info.get("inherited_from"),
                        "is_override": widget_info.get("is_override", False),
                    }
                )

            widgets_by_slot[slot_name] = rendered_widgets

        # Check for empty slots that should inherit from parents
        for slot_name in layout_slot_names:
            if slot_name not in widgets_by_slot or not widgets_by_slot[slot_name]:
                # This slot is empty, look for parent widgets
                parent_widgets = self._find_parent_slot_widgets(page, slot_name)
                if parent_widgets:
                    rendered_widgets = []
                    slot_dimensions = slot_dimensions_map.get(slot_name)

                    for widget_data in parent_widgets:
                        context["layout_name"] = context["layout"].name
                        context["slot_name"] = slot_name
                        widget_html = self.render_widget_json(
                            widget_data["widget"],
                            context,
                            slot_dimensions=slot_dimensions,
                        )
                        rendered_widgets.append(
                            {
                                "html": widget_html,
                                "widget_data": widget_data["widget"],
                                "inherited_from": widget_data["inherited_from"],
                                "is_override": False,
                                "is_parent_slot_inheritance": True,  # Mark as parent slot inheritance
                            }
                        )
                    widgets_by_slot[slot_name] = rendered_widgets

        return widgets_by_slot

    def _find_parent_slot_widgets(self, page, slot_name):
        """
        Find widgets for a slot by looking up the parent hierarchy.
        Returns the first parent that has widgets in the specified slot.
        """
        current = page.parent
        while current:
            current_version = current.get_current_published_version()
            if not current_version:
                current_version = current.get_latest_published_version()

            if current_version and current_version.widgets:
                slot_widgets = current_version.widgets.get(slot_name, [])
                if slot_widgets:
                    # Found widgets in parent slot, return them with inheritance info
                    return [
                        {
                            "widget": widget_data,
                            "inherited_from": current,
                        }
                        for widget_data in sorted(
                            slot_widgets, key=lambda w: w.get("sort_order", 0)
                        )
                    ]

            # Move up the hierarchy
            current = current.parent

        return []

    def render_object(self, page, object_instance, version=None, context=None):
        """
        Render an object page with object data integrated into the context.

        Args:
            page: WebPage instance that links to the object
            object_instance: The actual object instance being rendered
            version: Optional specific PageVersion to render
            context: Optional additional template context

        Returns:
            dict: Contains 'html', 'css', 'meta', and 'debug_info'
        """
        # Build enhanced context with object data
        enhanced_context = context.copy() if context else {}
        enhanced_context.update(
            {
                "object": object_instance,
                "object_data": getattr(object_instance, "data", {}),
                "object_type": getattr(page, "linked_object_type", "unknown"),
                "is_object_page": True,
            }
        )

        # Use the standard render method with enhanced context
        return self.render(page, version, enhanced_context)

    def _get_layout_template_name(self, layout):
        """Get the Django template name for the layout."""
        if hasattr(layout, "template_name"):
            # Layout has explicit template name
            template_name = layout.template_name
            if not template_name.startswith("webpages/layouts/"):
                template_name = f"webpages/layouts/{template_name}"
            return template_name
        else:
            # Use layout name to construct template path
            layout_name = getattr(layout, "name", "default")
            return f"webpages/layouts/{layout_name.lower()}.html"

    def _collect_page_css(self, page, layout, widgets_by_slot):
        """Collect all CSS for the page including theme, layout, and widgets."""
        css_parts = []

        # Theme CSS
        theme = page.get_effective_theme()
        if theme and hasattr(theme, "css_content") and theme.css_content:
            css_parts.append(f"/* Theme: {theme.name} */")
            css_parts.append(theme.css_content)

        # Layout CSS
        if hasattr(layout, "css_content") and layout.css_content:
            css_parts.append(f"/* Layout: {layout.name} */")
            css_parts.append(layout.css_content)

        # Page-specific CSS
        if page.page_custom_css:
            css_parts.append("/* Page Custom CSS */")
            css_parts.append(page.page_custom_css)

        # Widget CSS
        widget_css = self._collect_widget_css(widgets_by_slot)
        if widget_css:
            css_parts.append("/* Widget CSS */")
            css_parts.append(widget_css)

        # CSS Variables
        css_variables = page.get_effective_css_data().get("merged_css_variables", {})
        if css_variables:
            css_parts.append("/* CSS Variables */")
            variables_css = ":root {\n"
            for var_name, var_value in css_variables.items():
                variables_css += f"  --{var_name}: {var_value};\n"
            variables_css += "}"
            css_parts.append(variables_css)

        return "\n\n".join(css_parts)

    def _collect_widget_css(self, widgets_by_slot):
        """Collect CSS from all widgets."""
        css_parts = []

        for slot_name, slot_widgets in widgets_by_slot.items():
            for widget_info in slot_widgets:
                widget_data = widget_info["widget_data"]
                widget_type_name = widget_data.get("widget_type") or widget_data.get(
                    "type"
                )

                # Try to get CSS from widget type
                from .widget_registry import widget_type_registry

                widget_type = (
                    widget_type_registry.get_widget_type_flexible(widget_type_name)
                    if widget_type_name
                    else None
                )

                if (
                    widget_type
                    and hasattr(widget_type, "css_content")
                    and widget_type.css_content
                ):
                    css_id = f'{widget_type_name}_{widget_data.get("id", "")}'
                    if css_id not in self._rendered_css:
                        css_parts.append(f"/* Widget: {widget_type_name} */")
                        css_parts.append(widget_type.css_content)
                        self._rendered_css.add(css_id)

        return "\n\n".join(css_parts)

    def _generate_meta_tags(self, page):
        """Generate HTML meta tags for the page."""
        meta_tags = []

        # Title
        title = page.meta_title or page.title
        meta_tags.append(f"<title>{title}</title>")

        # Description
        if page.meta_description:
            meta_tags.append(
                f'<meta name="description" content="{page.meta_description}">'
            )
        elif page.description:
            meta_tags.append(f'<meta name="description" content="{page.description}">')

        # Keywords
        if page.meta_keywords:
            meta_tags.append(f'<meta name="keywords" content="{page.meta_keywords}">')

        # Open Graph tags
        meta_tags.append(f'<meta property="og:title" content="{title}">')
        if page.meta_description:
            meta_tags.append(
                f'<meta property="og:description" content="{page.meta_description}">'
            )

        return "\n".join(meta_tags)

    def _generate_debug_info(self, page, page_version, layout):
        """Generate debug information for development."""
        return {
            "page_id": page.id,
            "page_title": page.title,
            "page_slug": page.slug,
            "version_id": page_version.id if page_version else None,
            "version_number": page_version.version_number if page_version else None,
            "layout_name": layout.name if layout else None,
            "layout_type": page.get_layout_type(),
            "theme_name": (
                page.get_effective_theme().name if page.get_effective_theme() else None
            ),
            "widget_count": (
                len(page_version.widgets)
                if page_version and page_version.widgets
                else 0
            ),
            "css_injection_enabled": page.enable_css_injection,
        }
