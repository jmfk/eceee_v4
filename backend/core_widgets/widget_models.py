"""
Pydantic models for widget configuration validation.

These models define the configuration schemas for the new core widget types.
"""

from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
import datetime as dt


class ContentConfig(BaseModel):
    """Configuration for Content widget"""

    content: str = Field(
        ...,
        description="HTML content to display",
        # Control specifications
        json_schema_extra={
            "component": "RichTextInput",
            "rows": 6,
            "toolbar": "full",
        },
    )
    allow_scripts: bool = Field(
        False,
        description="WARNING: Only enable for trusted content",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "warning": True,
        },
    )
    sanitize_html: bool = Field(
        True,
        description="Sanitize HTML to prevent XSS attacks",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )


class ImageMediaItem(BaseModel):
    """Individual media item for Image widget"""

    id: Optional[str] = Field(None, description="Media file ID")
    url: str = Field(..., description="Media URL (image or video)")
    type: Literal["image", "video"] = Field("image", description="Media type")
    altText: str = Field(
        ..., min_length=1, description="Alternative text for accessibility"
    )
    caption: Optional[str] = Field(None, description="Optional caption")
    title: Optional[str] = Field(None, description="Image title")
    photographer: Optional[str] = Field(None, description="Photographer or source")
    source: Optional[str] = Field(None, description="Image source")
    thumbnailUrl: Optional[str] = Field(None, description="Thumbnail URL for videos")
    width: Optional[int] = Field(None, description="Image width")
    height: Optional[int] = Field(None, description="Image height")


class ImageConfig(BaseModel):
    """Configuration for Image widget"""

    mediaItems: List[ImageMediaItem] = Field(
        default_factory=list, description="List of images/videos to display"
    )
    displayType: Literal["gallery", "carousel"] = Field(
        "gallery",
        description="How to display multiple items (single image display is automatic)",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "variant": "default",
            "order": 1,
            "group": "Display Options",
            "options": [
                {"value": "gallery", "label": "Gallery", "icon": "Grid"},
                {"value": "carousel", "label": "Carousel", "icon": "Play"},
            ],
        },
    )
    imageStyle: Optional[str] = Field(
        None,
        description="Named image style from the current theme (falls back to default if not found)",
        json_schema_extra={
            "component": "SelectInput",
            "order": 2,
            "group": "Display Options",
            "valueListName": "image-styles",  # References a value list
            "placeholder": "Select image style...",
        },
    )
    enableLightbox: bool = Field(
        True,
        description="Enable lightbox for full-size viewing",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Display Options",
            "order": 3,
            "variant": "toggle",
        },
    )
    showCaptions: bool = Field(
        True,
        description="Display captions",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Display Options",
            "order": 4,
            "variant": "toggle",
        },
    )
    autoPlay: bool = Field(
        False,
        description="Auto-play videos (if applicable)",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 5,
            "group": "Advanced Settings",
            "variant": "toggle",
        },
    )
    autoPlayInterval: int = Field(
        3,
        ge=1,
        le=30,
        description="Auto-play interval in seconds for carousel",
        json_schema_extra={
            "component": "SliderInput",
            "order": 6,
            "group": "Advanced Settings",
            "min": 1,
            "max": 30,
            "step": 1,
            "unit": "seconds",
            "showValue": True,
        },
    )

    # Collection support
    collectionId: Optional[str] = Field(
        None, description="ID of selected media collection"
    )
    collectionConfig: Optional[dict] = Field(
        None, description="Collection display configuration"
    )


class TableCell(BaseModel):
    """Individual table cell configuration"""

    content: str = Field("", description="Cell content")
    colspan: int = Field(1, ge=1, description="Number of columns to span")
    rowspan: int = Field(1, ge=1, description="Number of rows to span")
    alignment: Literal["left", "center", "right"] = Field(
        "left", description="Text alignment"
    )
    background_color: Optional[str] = Field(
        None, description="Background color (hex or CSS color)"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    font_weight: Literal["normal", "bold"] = Field("normal", description="Font weight")
    font_style: Literal["normal", "italic"] = Field("normal", description="Font style")
    padding: Optional[str] = Field(None, description="Cell padding (CSS value)")
    border: Optional[str] = Field(None, description="Cell border (CSS value)")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableRow(BaseModel):
    """Table row configuration"""

    cells: List[TableCell] = Field(..., description="List of cells in this row")
    is_header: bool = Field(False, description="Whether this is a header row")
    background_color: Optional[str] = Field(None, description="Row background color")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableConfig(BaseModel):
    """Configuration for Table widget"""

    rows: List[TableRow] = Field(..., min_items=1, description="Table rows")
    caption: Optional[str] = Field(None, description="Table caption")
    show_borders: bool = Field(True, description="Show table borders")
    striped_rows: bool = Field(True, description="Alternate row colors")
    hover_effect: bool = Field(True, description="Highlight rows on hover")
    responsive: bool = Field(True, description="Make table responsive on mobile")
    table_width: Literal["auto", "full"] = Field("full", description="Table width")
    css_class: Optional[str] = Field(None, description="Additional CSS class for table")


class LayoutWidgetConfig(BaseModel):
    """Base configuration for layout widgets (Footer, Header, Navigation, Sidebar)"""

    content: str = Field(..., description="Widget content (HTML)")
    background_color: Optional[str] = Field(
        None, description="Background color (hex or CSS color)"
    )
    background_image: Optional[str] = Field(None, description="Background image URL")
    background_size: Literal["cover", "contain", "auto"] = Field(
        "cover", description="Background image size"
    )
    background_position: Literal["center", "top", "bottom", "left", "right"] = Field(
        "center", description="Background image position"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    padding: Optional[str] = Field(None, description="Widget padding (CSS value)")
    margin: Optional[str] = Field(None, description="Widget margin (CSS value)")
    text_align: Literal["left", "center", "right", "justify"] = Field(
        "left", description="Text alignment"
    )
    css_class: Optional[str] = Field(None, description="Additional CSS class")
    custom_css: Optional[str] = Field(None, description="Custom CSS for this widget")


class FooterConfig(LayoutWidgetConfig):
    """Configuration for Footer widget"""

    show_copyright: bool = Field(True, description="Show copyright notice")
    copyright_text: Optional[str] = Field(None, description="Custom copyright text")
    social_links: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Social media links [{'name': 'Facebook', 'url': 'https://...', 'icon': 'fab fa-facebook'}]",
    )


class HeaderConfig(LayoutWidgetConfig):
    """Configuration for Header widget"""

    show_overlay: bool = Field(False, description="Show overlay on background image")
    overlay_color: Optional[str] = Field(None, description="Overlay color")
    overlay_opacity: float = Field(0.5, ge=0, le=1, description="Overlay opacity")
    hero_style: bool = Field(False, description="Use hero banner styling")
    min_height: Optional[str] = Field(None, description="Minimum height (CSS value)")


class NavigationItem(BaseModel):
    """Navigation menu item"""

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(False, description="Whether this item is active")
    children: List["NavigationItem"] = Field(
        default_factory=list, description="Submenu items"
    )


# Update forward reference
NavigationItem.model_rebuild()


class NavigationConfig(LayoutWidgetConfig):
    """Configuration for Navigation widget"""

    brand_name: Optional[str] = Field(None, description="Brand/logo name")
    brand_url: Optional[str] = Field(None, description="Brand/logo URL")
    brand_logo: Optional[str] = Field(None, description="Brand logo image URL")
    menu_items: List[NavigationItem] = Field(
        default_factory=list, description="Navigation menu items"
    )
    mobile_friendly: bool = Field(True, description="Enable mobile hamburger menu")
    sticky: bool = Field(False, description="Make navigation sticky on scroll")
    dropdown_enabled: bool = Field(True, description="Enable dropdown submenus")


class SidebarConfig(LayoutWidgetConfig):
    """Configuration for Sidebar widget"""

    position: Literal["left", "right"] = Field("right", description="Sidebar position")
    width: Optional[str] = Field(None, description="Sidebar width (CSS value)")
    collapsible: bool = Field(False, description="Make sidebar collapsible")
    widgets: List[Dict[str, Any]] = Field(
        default_factory=list, description="Nested widgets in sidebar sections"
    )


class FormField(BaseModel):
    """Individual form field configuration"""

    name: str = Field(..., min_length=1, description="Field name")
    label: str = Field(..., min_length=1, description="Field label")
    type: Literal[
        "text",
        "email",
        "phone",
        "number",
        "textarea",
        "select",
        "checkbox",
        "radio",
        "file",
        "date",
        "time",
    ] = Field(..., description="Field type")
    required: bool = Field(False, description="Required field")
    placeholder: Optional[str] = Field(None, description="Placeholder text")
    default_value: Optional[str] = Field(None, description="Default value")
    options: Optional[List[str]] = Field(
        None, description="Options for select/radio fields"
    )
    validation: Optional[Dict[str, Any]] = Field(
        None, description="Validation rules (min_length, max_length, pattern, etc.)"
    )
    help_text: Optional[str] = Field(None, description="Help text for the field")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class FormsConfig(BaseModel):
    """Configuration for Forms widget"""

    title: str = Field(
        ...,
        min_length=1,
        description="Form title",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Contact Form",
        },
    )
    description: Optional[str] = Field(
        None,
        description="Form description",
        json_schema_extra={
            "component": "TextareaInput",
            "rows": 3,
            "placeholder": "Optional form description...",
        },
    )
    fields: List[FormField] = Field(
        ...,
        min_items=1,
        description="Form fields",
        json_schema_extra={
            "component": "ReorderableInput",
            "allowAdd": True,
            "allowRemove": True,
            "allowReorder": True,
            "itemTemplate": {"name": "", "label": "", "type": "text"},
        },
    )
    submit_url: Optional[str] = Field(
        None,
        description="Form submission URL",
        json_schema_extra={
            "component": "URLInput",
            "placeholder": "https://example.com/submit",
        },
    )
    submit_method: Literal["POST", "GET"] = Field(
        "POST",
        description="HTTP method",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "variant": "default",
            "options": [
                {"value": "POST", "label": "POST"},
                {"value": "GET", "label": "GET"},
            ],
        },
    )
    success_message: str = Field(
        "Thank you for your submission!",
        description="Success message",
        json_schema_extra={
            "component": "TextareaInput",
            "rows": 2,
        },
    )
    error_message: str = Field(
        "There was an error submitting the form. Please try again.",
        description="Error message",
        json_schema_extra={
            "component": "TextareaInput",
            "rows": 2,
        },
    )
    submit_button_text: str = Field(
        "Submit",
        description="Submit button text",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Submit",
        },
    )
    reset_button: bool = Field(
        False,
        description="Show reset button",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )
    ajax_submit: bool = Field(
        True,
        description="Submit form via AJAX",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )
    redirect_url: Optional[str] = Field(
        None,
        description="Redirect URL after submission",
        json_schema_extra={
            "component": "URLInput",
            "placeholder": "https://example.com/success",
        },
    )
    email_notifications: bool = Field(False, description="Send email notifications")
    notification_email: Optional[str] = Field(
        None, description="Notification email address"
    )
    store_submissions: bool = Field(
        True, description="Store form submissions in database"
    )
    honeypot_protection: bool = Field(
        True, description="Enable honeypot spam protection"
    )
    recaptcha_enabled: bool = Field(False, description="Enable reCAPTCHA protection")
    css_framework: Literal["default", "bootstrap", "tailwind", "custom"] = Field(
        "default", description="CSS framework for styling"
    )
