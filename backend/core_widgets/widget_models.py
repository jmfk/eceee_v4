"""
Pydantic models for widget configuration validation.

These models replace the JSON schema validation previously used in the database
WidgetType model, providing type-safe configuration for all widget types.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
import datetime as dt


class TextBlockConfig(BaseModel):
    """Configuration for Text Block widget"""

    title: Optional[str] = Field(None, description="Optional title for the text block")
    content: str = Field(..., description="Main text content")
    alignment: Literal["left", "center", "right", "justify"] = Field(
        "left", description="Text alignment"
    )
    style: Literal["normal", "bold", "italic"] = Field(
        "normal", description="Text style"
    )


class ImageConfig(BaseModel):
    """Configuration for Image widget"""

    image_url: HttpUrl = Field(..., description="URL or path to the image")
    alt_text: str = Field(
        ..., min_length=1, description="Alternative text for accessibility"
    )
    caption: Optional[str] = Field(None, description="Optional caption below the image")
    size: Literal["small", "medium", "large", "full"] = Field(
        "medium", description="Image size"
    )
    alignment: Literal["left", "center", "right"] = Field(
        "center", description="Alignment"
    )


class ButtonConfig(BaseModel):
    """Configuration for Button widget"""

    text: str = Field(..., min_length=1, description="Text displayed on the button")
    url: HttpUrl = Field(..., description="Link destination")
    style: Literal["primary", "secondary", "outline"] = Field(
        "primary", description="Button style"
    )
    size: Literal["small", "medium", "large"] = Field(
        "medium", description="Button size"
    )
    open_in_new_tab: bool = Field(False, description="Open in new tab")


class SpacerConfig(BaseModel):
    """Configuration for Spacer widget"""

    height: Literal["small", "medium", "large", "custom"] = Field(
        "medium", description="Height"
    )
    custom_height: Optional[str] = Field(
        None,
        pattern=r"^[0-9]+px$",
        description="Custom height in pixels (only used if height is 'custom')",
    )


class HTMLBlockConfig(BaseModel):
    """Configuration for HTML Block widget"""

    html_content: str = Field(..., min_length=1, description="Raw HTML content")
    allow_scripts: bool = Field(
        False, description="WARNING: Only enable for trusted content"
    )


class NewsConfig(BaseModel):
    """Configuration for News widget"""

    title: str = Field(
        ..., min_length=1, description="Main headline for the news article"
    )
    summary: Optional[str] = Field(None, description="Brief summary or lead paragraph")
    content: str = Field(..., min_length=1, description="Full article content")
    author: Optional[str] = Field(None, description="Article author name")
    publication_date: Optional[dt.date] = Field(
        None, description="When the article was published"
    )
    featured_image: Optional[HttpUrl] = Field(None, description="URL to featured image")
    category: Literal[
        "general", "business", "technology", "sports", "health", "politics"
    ] = Field("general", description="News category")
    show_meta: bool = Field(True, description="Display author and publication date")


class EventConfig(BaseModel):
    """Configuration for Events widget"""

    event_title: str = Field(..., min_length=1, description="Name of the event")
    description: Optional[str] = Field(None, description="Event description")
    start_date: datetime = Field(..., description="Event start date and time")
    end_date: Optional[datetime] = Field(None, description="Event end date and time")
    location: Optional[str] = Field(None, description="Event venue or address")
    registration_url: Optional[HttpUrl] = Field(
        None, description="Link for event registration"
    )
    price: Optional[str] = Field(
        None, description="Event cost (e.g., 'Free', '$25', '$10-50')"
    )
    capacity: Optional[int] = Field(
        None, ge=1, description="Maximum number of attendees"
    )
    event_type: Literal[
        "conference", "workshop", "seminar", "meeting", "social", "other"
    ] = Field("other", description="Event type")


class CalendarEventConfig(BaseModel):
    """Individual event configuration for calendar widget"""

    title: str = Field(..., min_length=1, description="Event title")
    date: dt.date = Field(..., description="Event date")
    time: Optional[str] = Field(None, description="Event time")
    description: Optional[str] = Field(None, description="Event description")


class CalendarConfig(BaseModel):
    """Configuration for Calendar widget"""

    title: Optional[str] = Field(None, description="Optional title for the calendar")
    view_type: Literal["month", "week", "agenda"] = Field(
        "month", description="View type"
    )
    default_date: Optional[dt.date] = Field(None, description="Initial date to display")
    event_source: Literal["manual", "api", "external"] = Field(
        "manual", description="Event source"
    )
    events: List[CalendarEventConfig] = Field(
        default_factory=list, description="Manual events for the calendar"
    )
    show_navigation: bool = Field(
        True, description="Show month/week navigation controls"
    )
    highlight_today: bool = Field(True, description="Highlight current date")


class FormFieldConfig(BaseModel):
    """Individual form field configuration"""

    name: str = Field(..., min_length=1, description="Field name")
    label: str = Field(..., min_length=1, description="Field label")
    type: Literal[
        "text", "email", "phone", "textarea", "select", "checkbox", "radio"
    ] = Field(..., description="Field type")
    required: bool = Field(False, description="Required field")
    placeholder: Optional[str] = Field(None, description="Placeholder text")
    options: Optional[List[str]] = Field(
        None, description="Options for select/radio fields"
    )


class FormsConfig(BaseModel):
    """Configuration for Forms widget"""

    form_title: str = Field(
        ..., min_length=1, description="Title displayed above the form"
    )
    form_description: Optional[str] = Field(
        None, description="Optional description text"
    )
    submit_url: Optional[HttpUrl] = Field(
        None, description="Where to submit the form data"
    )
    success_message: str = Field(
        "Thank you for your submission!",
        description="Message shown after successful submission",
    )
    fields: List[FormFieldConfig] = Field(
        ..., description="List of form fields to display"
    )
    submit_button_text: str = Field("Submit", description="Submit button text")


class GalleryImageConfig(BaseModel):
    """Individual image configuration for gallery widget"""

    url: HttpUrl = Field(..., description="Image URL")
    thumbnail: Optional[HttpUrl] = Field(None, description="Thumbnail URL")
    alt_text: str = Field(..., min_length=1, description="Alt text")
    caption: Optional[str] = Field(None, description="Caption")
    description: Optional[str] = Field(None, description="Description")


class GalleryConfig(BaseModel):
    """Configuration for Gallery widget"""

    title: Optional[str] = Field(None, description="Optional title for the gallery")
    layout: Literal["grid", "masonry", "carousel", "lightbox"] = Field(
        "grid", description="Gallery layout"
    )
    columns: int = Field(3, ge=1, le=6, description="Number of columns for grid layout")
    images: List[GalleryImageConfig] = Field(
        ..., description="List of images in the gallery"
    )
    show_captions: bool = Field(True, description="Display image captions")
    enable_lightbox: bool = Field(True, description="Allow full-size viewing")
    auto_play: bool = Field(False, description="Auto-advance carousel slides")


# Default/fallback configuration for widgets without specific schemas
class DefaultConfig(BaseModel):
    """Default configuration for widgets without specific configuration"""

    title: Optional[str] = Field(None, description="Optional title")
    content: Optional[str] = Field(None, description="Optional content")
