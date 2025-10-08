"""
Widget Inheritance Tree Types

Shared type definitions for widget inheritance tree structure.
These types must match the TypeScript interfaces exactly.
"""

from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass
from enum import Enum


class WidgetInheritanceBehavior(str, Enum):
    """Widget inheritance behavior options - must match TypeScript enum"""

    OVERRIDE_PARENT = "override_parent"
    INSERT_AFTER_PARENT = "insert_after_parent"
    INSERT_BEFORE_PARENT = "insert_before_parent"


@dataclass
class TreePageData:
    """Page metadata in inheritance tree - must match TypeScript TreePageData"""

    id: int
    title: str
    slug: str
    parent_id: Optional[int]

    # Optional metadata
    description: Optional[str] = None
    layout: Optional[str] = None
    theme: Optional[str] = None
    hostname: Optional[str] = None


@dataclass
class TreeWidget:
    """Widget in inheritance tree - must match TypeScript TreeWidget"""

    # Core widget data
    id: str
    type: str
    config: Dict[str, Any]
    order: int

    # Inheritance metadata
    depth: int
    inheritance_behavior: WidgetInheritanceBehavior
    is_published: bool
    inheritance_level: int

    # Optional publishing fields
    publish_effective_date: Optional[str] = None
    publish_expire_date: Optional[str] = None

    # Computed fields (added during tree building)
    is_local: bool = False  # True if depth === 0
    is_inherited: bool = False  # True if depth > 0
    can_be_overridden: bool = True  # True if inheritance allows replacement


@dataclass
class InheritanceTreeNode:
    """Tree node representing a page and its widgets - must match TypeScript InheritanceTreeNode"""

    page_id: int
    depth: int
    page: TreePageData
    slots: Dict[str, List[TreeWidget]]
    parent: Optional["InheritanceTreeNode"]


@dataclass
class MergeOptions:
    """Options for merging widgets - must match TypeScript MergeOptions"""

    mode: Optional[str] = None  # 'edit' or 'preview'
    apply_inheritance_behavior: bool = True  # Apply before/after/override logic
    respect_publishing: bool = True  # Filter by publishing status


@dataclass
class SlotQueryOptions:
    """Options for slot queries - must match TypeScript SlotQueryOptions"""

    include_unpublished: bool = False  # Include unpublished widgets
    max_depth: Optional[int] = None  # Maximum inheritance depth to consider
    respect_inheritance_level: bool = True  # Apply widget inheritance_level limits


# Predicate function types for tree traversal
TreeNodePredicate = Callable[[InheritanceTreeNode], bool]
WidgetPredicate = Callable[[TreeWidget], bool]


class InheritanceTreeError(Exception):
    """Error types for consistent error handling - must match TypeScript InheritanceTreeError"""

    def __init__(self, code: str, details: Any = None):
        self.code = code
        self.details = details
        super().__init__(f"InheritanceTree error: {code}")


class InheritanceTreeErrorCode:
    """Standard error codes - must match TypeScript enum"""

    SLOT_NOT_FOUND = "SLOT_NOT_FOUND"
    WIDGET_NOT_FOUND = "WIDGET_NOT_FOUND"
    INVALID_DEPTH = "INVALID_DEPTH"
    TREE_GENERATION_FAILED = "TREE_GENERATION_FAILED"
    CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE"


@dataclass
class InheritanceAnalysis:
    """Analysis of inheritance patterns - must match TypeScript InheritanceAnalysis"""

    total_widgets: int
    local_widgets: int
    inherited_widgets: int
    depth_distribution: Dict[int, int]  # depth -> widget count
    type_distribution: Dict[str, int]  # type -> widget count
    behavior_distribution: Dict[
        WidgetInheritanceBehavior, int
    ]  # behavior -> widget count


@dataclass
class TreeStatistics:
    """Tree statistics for debugging and monitoring - must match TypeScript TreeStatistics"""

    node_count: int  # Total nodes in tree
    max_depth: int  # Deepest inheritance level
    total_widgets: int  # Total widgets across all nodes
    slot_utilization: Dict[str, float]  # slot -> percentage utilization
    average_widgets_per_slot: float
    generation_time_ms: Optional[float] = None  # Time taken to generate tree


# Type aliases for convenience
TreeNodeDict = Dict[str, Any]  # JSON representation of tree node
WidgetDict = Dict[str, Any]  # JSON representation of widget
