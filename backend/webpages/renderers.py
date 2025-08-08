"""
Polymorphic widget rendering system
Following Sandi Metz principle: "Replace conditionals with objects"
"""

from django.template.loader import get_template
from django.template import Context
from django.utils.safestring import mark_safe
from abc import ABC, abstractmethod


class BaseWidgetRenderer(ABC):
    """Base class for all widget renderers"""

    def __init__(self, widget, context=None):
        self.widget = widget
        self.context = context or {}

    @abstractmethod
    def render(self):
        """Render the widget to HTML"""
        pass

    def get_config(self):
        """Get widget configuration with safe defaults"""
        return self.widget.configuration or {}

    def render_template(self, template_name, extra_context=None):
        """Helper to render template with widget context"""
        template = get_template(template_name)
        context = {
            "widget": self.widget,
            "config": self.get_config(),
            **self.context,
            **(extra_context or {}),
        }
        return template.render(context)


class ButtonWidgetRenderer(BaseWidgetRenderer):
    """Renders button widgets with style-specific logic"""

    def render(self):
        config = self.get_config()

        # Use strategy pattern for button styles
        style = config.get("style", "primary")
        size = config.get("size", "medium")

        style_renderer = self.get_style_renderer(style)

        context = {
            "style_classes": style_renderer.get_classes(),
            "style_attrs": style_renderer.get_attributes(),
            "size_classes": self.get_size_classes(size),
            "button_config": config,
        }

        return self.render_template("webpages/widgets/button_clean.html", context)

    def get_style_renderer(self, style):
        """Factory method for style renderers"""
        renderers = {
            "primary": PrimaryButtonStyle(),
            "secondary": SecondaryButtonStyle(),
            "outline": OutlineButtonStyle(),
        }
        return renderers.get(style, renderers["primary"])

    def get_size_classes(self, size):
        """Get CSS classes for button size"""
        size_map = {"small": "btn-small", "medium": "btn-medium", "large": "btn-large"}
        return size_map.get(size, "btn-medium")


class TextBlockWidgetRenderer(BaseWidgetRenderer):
    """Renders text block widgets"""

    def render(self):
        config = self.get_config()

        context = {
            "alignment_class": self.get_alignment_class(
                config.get("alignment", "left")
            ),
            "featured_class": (
                "text-featured" if config.get("is_featured", False) else ""
            ),
            "text_config": config,
        }

        return self.render_template("webpages/widgets/text_block_clean.html", context)

    def get_alignment_class(self, alignment):
        """Get CSS class for text alignment"""
        alignment_map = {
            "left": "text-left",
            "center": "text-center",
            "right": "text-right",
            "justify": "text-justify",
        }
        return alignment_map.get(alignment, "text-left")


class ImageWidgetRenderer(BaseWidgetRenderer):
    """Renders image widgets"""

    def render(self):
        config = self.get_config()

        context = {
            "responsive_class": (
                "img-responsive" if config.get("responsive", True) else ""
            ),
            "caption_enabled": bool(config.get("caption")),
            "image_config": config,
        }

        return self.render_template("webpages/widgets/image_clean.html", context)


class HtmlBlockWidgetRenderer(BaseWidgetRenderer):
    """Renders HTML block widgets"""

    def render(self):
        config = self.get_config()

        # Sanitize HTML content if needed
        html_content = config.get("content", "")

        context = {"html_content": mark_safe(html_content), "html_config": config}

        return self.render_template("webpages/widgets/html_block_clean.html", context)


class SpacerWidgetRenderer(BaseWidgetRenderer):
    """Renders spacer widgets"""

    def render(self):
        config = self.get_config()

        height = config.get("height", 20)
        height_class = self.get_height_class(height)

        context = {"height_class": height_class, "spacer_config": config}

        return self.render_template("webpages/widgets/spacer_clean.html", context)

    def get_height_class(self, height):
        """Get CSS class for spacer height"""
        # Map height values to predefined classes
        if height <= 10:
            return "spacer-xs"
        elif height <= 20:
            return "spacer-sm"
        elif height <= 40:
            return "spacer-md"
        elif height <= 80:
            return "spacer-lg"
        else:
            return "spacer-xl"


# Button style strategy pattern
class ButtonStyleRenderer(ABC):
    """Abstract base for button style renderers"""

    @abstractmethod
    def get_classes(self):
        """Return CSS classes for this style"""
        pass

    def get_attributes(self):
        """Return additional HTML attributes"""
        return {}


class PrimaryButtonStyle(ButtonStyleRenderer):
    def get_classes(self):
        return "btn-primary"


class SecondaryButtonStyle(ButtonStyleRenderer):
    def get_classes(self):
        return "btn-secondary"


class OutlineButtonStyle(ButtonStyleRenderer):
    def get_classes(self):
        return "btn-outline"


class WidgetRendererRegistry:
    """Registry for widget renderers following the registry pattern"""

    _renderers = {
        "text-block": TextBlockWidgetRenderer,
        "button": ButtonWidgetRenderer,
        "image": ImageWidgetRenderer,
        "html-block": HtmlBlockWidgetRenderer,
        "spacer": SpacerWidgetRenderer,
    }

    @classmethod
    def get_renderer(cls, widget_type_name):
        """Get renderer class for widget type"""
        return cls._renderers.get(widget_type_name.lower())

    @classmethod
    def register_renderer(cls, widget_type_name, renderer_class):
        """Register a new widget renderer"""
        cls._renderers[widget_type_name.lower()] = renderer_class

    @classmethod
    def render_widget(cls, widget, context=None):
        """Main entry point for rendering any widget"""
        widget_type_name = widget.widget_type.name
        renderer_class = cls.get_renderer(widget_type_name)

        if not renderer_class:
            # Fallback to generic renderer
            return cls._render_generic(widget, context)

        renderer = renderer_class(widget, context)
        return renderer.render()

    @classmethod
    def _render_generic(cls, widget, context):
        """Fallback renderer for unknown widget types"""
        template = get_template("webpages/widgets/generic.html")
        render_context = {
            "widget": widget,
            "config": widget.configuration or {},
            **(context or {}),
        }
        return template.render(render_context)


# Main widget renderer for use in views
class WidgetRenderer:
    """Main widget rendering facade"""

    def __init__(self, registry=None):
        self.registry = registry or WidgetRendererRegistry

    def render(self, widget, context=None):
        """Render a widget using the appropriate renderer"""
        return self.registry.render_widget(widget, context)

    def render_multiple(self, widgets, context=None):
        """Render multiple widgets"""
        rendered_widgets = []
        for widget in widgets:
            rendered_widgets.append(
                {"widget": widget, "html": self.render(widget, context)}
            )
        return rendered_widgets


class WebPageRenderer:
    """
    Comprehensive backend renderer for WebPage instances.
    Renders complete HTML pages including layout, widgets, theme, and CSS.
    """

    def __init__(self, request=None):
        self.request = request
        self.widget_renderer = WidgetRenderer()
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

    def render_widget_json(self, widget_data, context=None):
        """
        Render a widget from JSON data (as stored in PageVersion.widgets).

        Args:
            widget_data: Widget JSON data from PageVersion
            context: Optional template context

        Returns:
            str: Rendered widget HTML
        """
        from django.template.loader import render_to_string
        from .widget_registry import widget_registry

        # Get widget type from registry
        widget_type_name = widget_data.get("widget_type")
        widget_type = widget_registry.get_widget_type(widget_type_name)

        if not widget_type:
            return f'<!-- Widget type "{widget_type_name}" not found -->'

        # Create a mock widget object for template rendering
        class MockWidget:
            def __init__(self, widget_type, configuration):
                self.widget_type = widget_type
                self.configuration = configuration
                self.id = widget_data.get("id", "unknown")

        mock_widget = MockWidget(widget_type, widget_data.get("configuration", {}))

        # Render using the widget's template
        try:
            widget_html = render_to_string(
                widget_type.template_name,
                {
                    "widget": mock_widget,
                    "config": widget_data.get("configuration", {}),
                    **(context or {}),
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

        # Merge additional context
        if extra_context:
            context.update(extra_context)

        return context

    def _render_widgets_by_slot(self, page, page_version, context):
        """Render widgets organized by slot."""
        widgets_by_slot = {}

        # Get widget inheritance info
        widgets_info = page.get_widgets_inheritance_info()

        for slot_name, slot_info in widgets_info.items():
            rendered_widgets = []

            for widget_info in slot_info.get("widgets", []):
                widget_data = widget_info["widget"]

                # Render the widget
                widget_html = self.render_widget_json(widget_data, context)

                rendered_widgets.append(
                    {
                        "html": widget_html,
                        "widget_data": widget_data,
                        "inherited_from": widget_info.get("inherited_from"),
                        "is_override": widget_info.get("is_override", False),
                    }
                )

            widgets_by_slot[slot_name] = rendered_widgets

        return widgets_by_slot

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
                widget_type_name = widget_data.get("widget_type")

                # Try to get CSS from widget type
                from .widget_registry import widget_registry

                widget_type = widget_registry.get_widget_type(widget_type_name)

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
