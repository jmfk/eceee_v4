"""
Pydantic models for JSON field validation throughout the easy_v4 system.

These models provide type-safe validation for JSON fields in various models,
replacing ad-hoc JSON validation with structured pydantic models.
"""

from typing import Optional, List, Dict, Any, Union, Tuple
from pydantic import BaseModel, Field, validator, field_validator, model_validator
from datetime import datetime
from enum import Enum


class WidgetInheritanceBehavior(str, Enum):
    """Widget inheritance behavior options"""

    OVERRIDE_PARENT = "override_parent"  # Replace all parent widgets in slot
    INSERT_AFTER_PARENT = "insert_after_parent"  # Add after inherited widgets
    INSERT_BEFORE_PARENT = "insert_before_parent"  # Add before inherited widgets


# ============================================================================
# API Response Models
# ============================================================================


class PublicationStatus(str, Enum):
    """Publication status choices"""

    UNPUBLISHED = "unpublished"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    EXPIRED = "expired"


class UserResponse(BaseModel):
    """User data in API responses"""

    id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None


class WebPageTreeResponse(BaseModel):
    """Page data for tree views"""

    id: int
    title: str
    slug: str
    parent: Optional[int] = None
    sort_order: int = 0
    hostnames: List[str] = Field(default_factory=list)
    publication_status: PublicationStatus
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    children_count: int = 0


class ThemeResponse(BaseModel):
    """Theme data in API responses"""

    id: int
    name: str
    description: Optional[str] = None
    css_variables: Dict[str, str] = Field(default_factory=dict)
    is_active: bool = True


class LayoutResponse(BaseModel):
    """Layout data in API responses"""

    name: str
    description: Optional[str] = None
    slots: List[Dict[str, Any]] = Field(default_factory=list)
    template_path: Optional[str] = None


class WebPageDetailResponse(BaseModel):
    """Detailed page data"""

    id: int
    title: str
    slug: str
    description: Optional[str] = None
    parent: Optional[WebPageTreeResponse] = None
    parent_id: Optional[int] = None
    sort_order: int = 0
    hostnames: List[str] = Field(default_factory=list)
    code_layout: Optional[str] = None
    theme: Optional[ThemeResponse] = None
    theme_id: Optional[int] = None
    publication_status: PublicationStatus
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    created_by: UserResponse
    last_modified_by: UserResponse
    absolute_url: str
    is_published: bool
    breadcrumbs: List[Dict[str, Any]] = Field(default_factory=list)
    effective_layout: Optional[LayoutResponse] = None
    effective_theme: Optional[ThemeResponse] = None
    layout_type: Optional[str] = None
    layout_inheritance_info: Dict[str, Any] = Field(default_factory=dict)
    theme_inheritance_info: Dict[str, Any] = Field(default_factory=dict)
    available_code_layouts: List[LayoutResponse] = Field(default_factory=list)
    children_count: int = 0


class WebPageListResponse(BaseModel):
    """Page data for list views"""

    id: int
    title: str
    slug: str
    description: Optional[str] = None
    parent: Optional[WebPageTreeResponse] = None
    sort_order: int = 0
    hostnames: List[str] = Field(default_factory=list)
    publication_status: PublicationStatus
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: UserResponse
    last_modified_by: UserResponse
    is_published: bool
    children_count: int = 0
    layout: Optional[LayoutResponse] = None
    theme: Optional[ThemeResponse] = None


class PaginatedResponse(BaseModel):
    """Paginated API response"""

    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[Any] = Field(default_factory=list)


# ============================================================================
# PageVersion JSON Models
# ============================================================================


class PageWidgetData(BaseModel):
    """Individual widget configuration within a PageVersion"""

    widget_type: Optional[str] = Field(
        None, description="Name of the widget type (legacy)"
    )
    type: Optional[str] = Field(
        None,
        description="Widget type identifier (new format: easy_widgets.WidgetName)",
    )
    slot_name: str = Field(..., description="Slot where the widget is placed")
    sort_order: int = Field(0, description="Order within the slot")
    configuration: Dict[str, Any] = Field(
        default_factory=dict, description="Widget-specific configuration"
    )

    @field_validator("widget_type", "type")
    def validate_widget_type(cls, v, info):
        """Ensure at least one widget type field is provided."""
        # This will be called for each field, but we need to check if at least one is provided
        # We'll handle this in model_validator instead
        return v

    @model_validator(mode="after")
    def validate_widget_type_present(self):
        """Ensure at least one widget type field is provided."""
        if not self.widget_type and not self.type:
            raise ValueError("Either 'widget_type' or 'type' must be provided")
        return self

    # Optional metadata
    id: Optional[str] = Field(
        None, description="Unique identifier for the widget instance"
    )
    inheritance_behavior: WidgetInheritanceBehavior = Field(
        WidgetInheritanceBehavior.INSERT_AFTER_PARENT,
        description="How this widget behaves with parent widgets",
    )
    is_visible: bool = Field(True, description="Whether the widget is visible")
    is_active: bool = Field(
        True, description="Whether the widget is active and should be rendered"
    )

    # Backward compatibility - deprecated fields
    inherit_from_parent: Optional[bool] = Field(
        None, description="DEPRECATED: Use inheritance_behavior instead"
    )
    override_parent: Optional[bool] = Field(
        None, description="DEPRECATED: Use inheritance_behavior instead"
    )


class PageDataSnapshot(BaseModel):
    """Page data snapshot stored in PageVersion.page_data"""

    title: str = Field(..., description="Page title")
    short_title: Optional[str] = Field(None, description="Short title for navigation")
    slug: str = Field(..., description="Page slug")
    description: Optional[str] = Field(None, description="Page description")
    code_layout: Optional[str] = Field(None, description="Layout name")
    css_variables: Optional[Dict[str, str]] = Field(
        None, description="CSS custom properties"
    )

    # SEO fields
    meta_title: Optional[str] = Field(None, description="SEO meta title")
    meta_description: Optional[str] = Field(None, description="SEO meta description")
    meta_keywords: Optional[str] = Field(None, description="SEO meta keywords")

    # Status fields
    is_published: bool = Field(False, description="Whether the page is published")
    is_homepage: bool = Field(False, description="Whether this is the homepage")

    # Timestamps (as ISO strings in JSON)
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class ChangeType(str, Enum):
    """Types of changes that can be tracked"""

    FIELD_CHANGE = "field_change"
    WIDGET_ADD = "widget_add"
    WIDGET_REMOVE = "widget_remove"
    WIDGET_MODIFY = "widget_modify"
    WIDGET_REORDER = "widget_reorder"
    LAYOUT_CHANGE = "layout_change"


class FieldChange(BaseModel):
    """Individual field change details"""

    field: str = Field(..., description="Name of the changed field")
    old_value: Any = Field(None, description="Previous value")
    new_value: Any = Field(None, description="New value")


class WidgetChange(BaseModel):
    """Widget change details"""

    widget_type: str = Field(..., description="Widget type name")
    slot_name: str = Field(..., description="Slot name")
    sort_order: Optional[int] = Field(None, description="Sort order")
    old_configuration: Optional[Dict[str, Any]] = Field(
        None, description="Previous configuration"
    )
    new_configuration: Optional[Dict[str, Any]] = Field(
        None, description="New configuration"
    )


class ChangeSummary(BaseModel):
    """Summary of changes in a PageVersion"""

    change_type: List[ChangeType] = Field(
        default_factory=list, description="Types of changes made"
    )
    field_changes: List[FieldChange] = Field(
        default_factory=list, description="Field-level changes"
    )
    widget_changes: List[WidgetChange] = Field(
        default_factory=list, description="Widget-level changes"
    )
    summary_text: Optional[str] = Field(None, description="Human-readable summary")
    changed_by: Optional[str] = Field(None, description="Username who made the changes")
    change_timestamp: Optional[str] = Field(None, description="When changes were made")


# ============================================================================
# Content Model JSON Fields
# ============================================================================


class ImageReference(BaseModel):
    """Reference to an image with metadata"""

    url: str = Field(..., description="Image URL")
    alt_text: Optional[str] = Field(None, description="Alternative text")
    caption: Optional[str] = Field(None, description="Image caption")
    title: Optional[str] = Field(None, description="Image title")
    width: Optional[int] = Field(None, description="Image width in pixels")
    height: Optional[int] = Field(None, description="Image height in pixels")
    file_size: Optional[int] = Field(None, description="File size in bytes")


class GalleryImages(BaseModel):
    """Collection of images for gallery display"""

    images: List[ImageReference] = Field(
        default_factory=list, description="List of images"
    )

    @validator("images")
    def validate_images(cls, v):
        if len(v) > 100:  # Reasonable limit
            raise ValueError("Too many images in gallery (max 100)")
        return v


class ExpertiseArea(BaseModel):
    """Individual area of expertise"""

    name: str = Field(..., description="Name of the expertise area")
    description: Optional[str] = Field(None, description="Description of expertise")
    level: Optional[str] = Field(
        None,
        description="Proficiency level (e.g., 'Expert', 'Advanced', 'Intermediate')",
    )
    years_experience: Optional[int] = Field(
        None, ge=0, le=100, description="Years of experience"
    )


class ExpertiseAreas(BaseModel):
    """Collection of expertise areas for members"""

    areas: List[ExpertiseArea] = Field(
        default_factory=list, description="List of expertise areas"
    )

    @validator("areas")
    def validate_areas(cls, v):
        if len(v) > 50:  # Reasonable limit
            raise ValueError("Too many expertise areas (max 50)")
        return v


class AttachmentFile(BaseModel):
    """File attachment with metadata"""

    filename: str = Field(..., description="Original filename")
    url: str = Field(..., description="File URL or path")
    content_type: Optional[str] = Field(None, description="MIME type")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    description: Optional[str] = Field(None, description="File description")
    upload_date: Optional[str] = Field(None, description="Upload timestamp")
    uploaded_by: Optional[str] = Field(
        None, description="Username who uploaded the file"
    )


class Attachments(BaseModel):
    """Collection of file attachments"""

    files: List[AttachmentFile] = Field(
        default_factory=list, description="List of attached files"
    )

    @validator("files")
    def validate_files(cls, v):
        if len(v) > 20:  # Reasonable limit
            raise ValueError("Too many attachments (max 20)")
        return v


# ============================================================================
# CSS Variables Model
# ============================================================================


class CSSVariables(BaseModel):
    """CSS custom properties for styling"""

    variables: Dict[str, str] = Field(
        default_factory=dict, description="CSS custom properties"
    )

    @validator("variables")
    def validate_css_variables(cls, v):
        """Validate CSS variable names and values"""
        for key, value in v.items():
            # CSS custom property names must start with --
            if not key.startswith("--"):
                raise ValueError(f'CSS variable name must start with "--": {key}')

            # Basic validation for CSS values (could be enhanced)
            if not isinstance(value, str):
                raise ValueError(f"CSS variable value must be a string: {key}")

            # Check for dangerous content (basic XSS prevention)
            dangerous_patterns = ["javascript:", "<script", "expression("]
            if any(pattern in value.lower() for pattern in dangerous_patterns):
                raise ValueError(f"Potentially dangerous CSS value: {key}")

        return v


# ============================================================================
# Utility Functions
# ============================================================================


def validate_json_field(model_class: type, data: Any) -> Tuple[bool, List[str]]:
    """
    Validate JSON data against a pydantic model.

    Args:
        model_class: Pydantic model class to validate against
        data: Data to validate

    Returns:
        Tuple of (is_valid, error_messages)
    """
    try:
        model_class.parse_obj(data)
        return True, []
    except Exception as e:
        return False, [str(e)]


def parse_json_field(model_class: type, data: Any):
    """
    Parse and validate JSON data, returning model instance.

    Args:
        model_class: Pydantic model class
        data: Data to parse

    Returns:
        Model instance

    Raises:
        ValidationError if data is invalid
    """
    return model_class.parse_obj(data)
