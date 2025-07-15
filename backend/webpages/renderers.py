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
