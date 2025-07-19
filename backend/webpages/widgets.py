"""
Built-in widget type implementations for the eceee_v4 CMS.

These widget types replace the database-defined WidgetType model and use
pydantic for configuration validation.
"""

from typing import Type
from pydantic import BaseModel

from .widget_registry import BaseWidget, register_widget_type
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
    """Call-to-action button with customizable text and link"""

    name = "Button"
    description = "Call-to-action button with customizable text and link"
    template_name = "webpages/widgets/button.html"

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
