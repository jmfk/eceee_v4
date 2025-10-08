"""
Page Structure Query Types

Shared type definitions for querying page and widget structure.
These types must match the TypeScript interfaces exactly.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class PageStatus(str, Enum):
    """Page publishing status"""

    PUBLISHED = "published"
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    EXPIRED = "expired"


class VersionStatus(str, Enum):
    """Version status"""

    CURRENT = "current"
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    EXPIRED = "expired"
    HISTORICAL = "historical"


class VersionFilter(str, Enum):
    """Filter for which version to retrieve"""

    CURRENT_PUBLISHED = "current_published"  # Currently live version
    LATEST = "latest"  # Most recent version regardless of status
    LATEST_DRAFT = "latest_draft"  # Most recent draft version
    LATEST_PUBLISHED = "latest_published"  # Most recent published (current or expired)


@dataclass
class PageMetadata:
    """Basic page metadata - must match TypeScript PageMetadata"""

    id: int
    title: str
    slug: str
    description: str
    path: str  # Full path from root
    parent_id: Optional[int]
    is_root: bool
    created_at: str
    updated_at: str
    created_by: str
    last_modified_by: str
    # Optional version information (included when requested)
    version: Optional["VersionMetadata"] = None


@dataclass
class VersionMetadata:
    """Version metadata - must match TypeScript VersionMetadata"""

    id: int
    version_number: int
    version_title: str
    meta_title: str
    meta_description: str
    code_layout: Optional[str]
    theme_id: Optional[int]
    theme_name: Optional[str]
    effective_date: Optional[str]
    expiry_date: Optional[str]
    created_at: str
    created_by: str
    status: VersionStatus


@dataclass
class PageWithVersion:
    """Page with current version info - must match TypeScript PageWithVersion"""

    page: PageMetadata
    current_version: Optional[VersionMetadata]
    published_version: Optional[VersionMetadata]
    latest_version: Optional[VersionMetadata]
    version_count: int
    has_draft: bool


@dataclass
class ChildPageInfo:
    """Information about a child page - must match TypeScript ChildPageInfo"""

    page: PageMetadata
    current_version: Optional[VersionMetadata]
    child_count: int  # Number of children this page has
    sort_order: int


@dataclass
class PageTreeNode:
    """Hierarchical tree node - must match TypeScript PageTreeNode"""

    page: PageMetadata
    current_version: Optional[VersionMetadata]
    children: List["PageTreeNode"]
    child_count: int
    depth: int


@dataclass
class WidgetSummary:
    """Summary of widgets on a page - must match TypeScript WidgetSummary"""

    slot_name: str
    widget_count: int
    widget_types: List[str]
    has_inherited: bool
    has_local: bool


@dataclass
class PageStructureSummary:
    """Summary of page structure - must match TypeScript PageStructureSummary"""

    page: PageMetadata
    current_version: Optional[VersionMetadata]
    ancestor_count: int
    ancestor_ids: List[int]
    child_count: int
    descendant_count: int
    widget_summary: List[WidgetSummary]
    hostnames: List[str]


@dataclass
class PageSearchOptions:
    """Options for searching pages - must match TypeScript PageSearchOptions"""

    include_drafts: bool = False
    include_unpublished: bool = False
    parent_id: Optional[int] = None
    root_only: bool = False
    has_published_version: Optional[bool] = None
    layout_type: Optional[str] = None
    theme_id: Optional[int] = None
    hostname: Optional[str] = None


@dataclass
class VersionSearchOptions:
    """Options for searching versions - must match TypeScript VersionSearchOptions"""

    page_id: Optional[int] = None
    status: Optional[VersionStatus] = None
    has_layout: Optional[bool] = None
    has_theme: Optional[bool] = None
    created_after: Optional[str] = None
    created_before: Optional[str] = None


@dataclass
class BreadcrumbItem:
    """Breadcrumb navigation item - must match TypeScript BreadcrumbItem"""

    page_id: int
    title: str
    slug: str
    path: str


class StructureQueryError(Exception):
    """Error types for structure queries - must match TypeScript StructureQueryError"""

    def __init__(self, code: str, message: str, details: Any = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(f"StructureQuery error: {code} - {message}")


class StructureQueryErrorCode:
    """Standard error codes - must match TypeScript enum"""

    PAGE_NOT_FOUND = "PAGE_NOT_FOUND"
    VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
    INVALID_PATH = "INVALID_PATH"
    CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE"
    DATABASE_ERROR = "DATABASE_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"


# Type aliases for convenience
PageDict = Dict[str, Any]  # JSON representation of page
VersionDict = Dict[str, Any]  # JSON representation of version
