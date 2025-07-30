"""
Built-in widget type implementations for the eceee_v4 CMS.

These widget types replace the database-defined WidgetType model and use
pydantic for configuration validation.
"""

from typing import Type
from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from .widget_models import (
    TextBlockConfig,
    ImageConfig,
    ButtonConfig,
    SpacerConfig,
    HTMLBlockConfig,
    NewsConfig,
    EventConfig,
    CalendarConfig,
    FormsConfig,
    GalleryConfig,
    DefaultConfig,
)


@register_widget_type
class TextBlockWidget(BaseWidget):
    """Rich text content block with title and formatting options"""

    name = "Text Block"
    description = "Rich text content block with title and formatting options"
    template_name = "webpages/widgets/text_block.html"

    # Enhanced CSS injection capabilities
    widget_css = """
    .text-block-widget {
        font-family: var(--text-font, inherit);
        line-height: var(--text-line-height, 1.6);
        color: var(--text-color, inherit);
    }
    
    .text-block-widget .title {
        font-size: var(--title-size, 1.25rem);
        font-weight: var(--title-weight, 600);
        margin-bottom: var(--title-spacing, 0.5rem);
        color: var(--title-color, inherit);
    }
    
    .text-block-widget.alignment-center {
        text-align: center;
    }
    
    .text-block-widget.alignment-right {
        text-align: right;
    }
    
    .text-block-widget.style-bold {
        font-weight: bold;
    }
    
    .text-block-widget.style-italic {
        font-style: italic;
    }
    """

    css_variables = {
        "text-font": "inherit",
        "text-line-height": "1.6",
        "text-color": "inherit",
        "title-size": "1.25rem",
        "title-weight": "600",
        "title-spacing": "0.5rem",
        "title-color": "inherit",
    }

    css_scope = "widget"  # Scope CSS to widget instances

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TextBlockConfig


@register_widget_type
class ImageWidget(BaseWidget):
    """Image display with caption and sizing options"""

    name = "Image"
    description = "Image display with caption and sizing options"
    template_name = "webpages/widgets/image.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ImageConfig


@register_widget_type
class ButtonWidget(BaseWidget):
    """Interactive button widget with various styles and CSS customization"""

    name = "Button"
    description = "Interactive button with multiple styles and customizable appearance"
    template_name = "webpages/widgets/button.html"

    # Enhanced CSS with dynamic styling
    widget_css = """
    .button-widget {
        display: inline-block;
        font-family: var(--button-font, inherit);
        transition: all 0.2s ease-in-out;
        border: none;
        cursor: pointer;
        text-decoration: none;
    }
    
    .button-widget.size-small {
        padding: var(--button-padding-small, 0.375rem 0.75rem);
        font-size: var(--button-font-size-small, 0.875rem);
        border-radius: var(--button-radius-small, 0.375rem);
    }
    
    .button-widget.size-medium {
        padding: var(--button-padding-medium, 0.5rem 1rem);
        font-size: var(--button-font-size-medium, 1rem);
        border-radius: var(--button-radius-medium, 0.5rem);
    }
    
    .button-widget.size-large {
        padding: var(--button-padding-large, 0.75rem 1.5rem);
        font-size: var(--button-font-size-large, 1.125rem);
        border-radius: var(--button-radius-large, 0.75rem);
    }
    
    .button-widget.style-primary {
        background-color: var(--button-primary-bg, #3b82f6);
        color: var(--button-primary-text, white);
        box-shadow: var(--button-primary-shadow, 0 1px 3px rgba(0, 0, 0, 0.1));
    }
    
    .button-widget.style-primary:hover {
        background-color: var(--button-primary-hover, #2563eb);
        transform: translateY(-1px);
        box-shadow: var(--button-primary-hover-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
    }
    
    .button-widget.style-secondary {
        background-color: var(--button-secondary-bg, #6b7280);
        color: var(--button-secondary-text, white);
    }
    
    .button-widget.style-secondary:hover {
        background-color: var(--button-secondary-hover, #4b5563);
    }
    
    .button-widget.style-outline {
        background-color: transparent;
        color: var(--button-outline-text, #3b82f6);
        border: 2px solid var(--button-outline-border, #3b82f6);
    }
    
    .button-widget.style-outline:hover {
        background-color: var(--button-outline-hover-bg, #3b82f6);
        color: var(--button-outline-hover-text, white);
    }
    """

    css_variables = {
        "button-font": "inherit",
        "button-padding-small": "0.375rem 0.75rem",
        "button-padding-medium": "0.5rem 1rem",
        "button-padding-large": "0.75rem 1.5rem",
        "button-font-size-small": "0.875rem",
        "button-font-size-medium": "1rem",
        "button-font-size-large": "1.125rem",
        "button-radius-small": "0.375rem",
        "button-radius-medium": "0.5rem",
        "button-radius-large": "0.75rem",
        "button-primary-bg": "#3b82f6",
        "button-primary-text": "white",
        "button-primary-hover": "#2563eb",
        "button-secondary-bg": "#6b7280",
        "button-secondary-text": "white",
        "button-secondary-hover": "#4b5563",
        "button-outline-text": "#3b82f6",
        "button-outline-border": "#3b82f6",
        "button-outline-hover-bg": "#3b82f6",
        "button-outline-hover-text": "white",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ButtonConfig


@register_widget_type
class SpacerWidget(BaseWidget):
    """Vertical spacing element for layout control"""

    name = "Spacer"
    description = "Vertical spacing element for layout control"
    template_name = "webpages/widgets/spacer.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SpacerConfig


@register_widget_type
class HTMLBlockWidget(BaseWidget):
    """Custom HTML content block for advanced users"""

    name = "HTML Block"
    description = "Custom HTML content block for advanced users"
    template_name = "webpages/widgets/html_block.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HTMLBlockConfig


@register_widget_type
class NewsWidget(BaseWidget):
    """News article widget with title, summary, content, and metadata"""

    name = "News"
    description = "News article widget with title, summary, content, and metadata"
    template_name = "webpages/widgets/news.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NewsConfig


@register_widget_type
class EventsWidget(BaseWidget):
    """Event display widget with date, location, and registration details"""

    name = "Events"
    description = "Event display widget with date, location, and registration details"
    template_name = "webpages/widgets/events.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return EventConfig


@register_widget_type
class CalendarWidget(BaseWidget):
    """Calendar widget displaying events for a specific month or period"""

    name = "Calendar"
    description = "Calendar widget displaying events for a specific month or period"
    template_name = "webpages/widgets/calendar.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return CalendarConfig


@register_widget_type
class FormsWidget(BaseWidget):
    """Contact or general purpose form widget with custom fields"""

    name = "Forms"
    description = "Contact or general purpose form widget with custom fields"
    template_name = "webpages/widgets/forms.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FormsConfig


@register_widget_type
class GalleryWidget(BaseWidget):
    """Image gallery widget with multiple display options"""

    name = "Gallery"
    description = "Image gallery widget with multiple display options"
    template_name = "webpages/widgets/gallery.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return GalleryConfig


@register_widget_type
class DefaultWidget(BaseWidget):
    """Default widget for unknown or legacy widget types"""

    name = "Default"
    description = "Default widget for unknown or legacy widget types"
    template_name = "webpages/widgets/default.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return DefaultConfig
