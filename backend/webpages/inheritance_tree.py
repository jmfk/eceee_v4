"""
Widget Inheritance Tree Builder

Generates inheritance trees for widget rendering and provides unified access
to inherited widget data across the page hierarchy.
"""

import time
from typing import Dict, List, Optional, Set
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist

from .models import WebPage, PageVersion
from .inheritance_types import (
    InheritanceTreeNode,
    TreePageData,
    TreeWidget,
    WidgetInheritanceBehavior,
    InheritanceTreeError,
    InheritanceTreeErrorCode,
    TreeStatistics,
)


class InheritanceTreeBuilder:
    """
    Builder class for creating widget inheritance trees.

    Provides efficient tree generation and caching for widget inheritance
    data across page hierarchies.
    """

    def __init__(self):
        self._generation_start_time = None

    def build_tree(self, page: WebPage) -> InheritanceTreeNode:
        """
        Build complete inheritance tree for the given page.

        Args:
            page: The WebPage to build tree for (becomes root of tree)

        Returns:
            InheritanceTreeNode: Complete inheritance tree

        Raises:
            InheritanceTreeError: If tree generation fails
        """
        self._generation_start_time = time.time()

        try:
            # Detect circular references
            visited_pages = set()
            self._check_circular_references(page, visited_pages)

            # Build tree recursively
            tree = self._build_node(page, depth=0, visited=set())

            # Add computed fields to all widgets
            self._add_computed_fields(tree)

            return tree

        except Exception as e:
            raise InheritanceTreeError(
                InheritanceTreeErrorCode.TREE_GENERATION_FAILED,
                {"page_id": page.id, "error": str(e)},
            )

    def _check_circular_references(self, page: WebPage, visited: Set[int]) -> None:
        """Check for circular parent references"""
        if page.id in visited:
            raise InheritanceTreeError(
                InheritanceTreeErrorCode.CIRCULAR_REFERENCE,
                {"page_id": page.id, "visited": list(visited)},
            )

        visited.add(page.id)
        if page.parent:
            self._check_circular_references(page.parent, visited.copy())

    def _build_node(
        self, page: WebPage, depth: int, visited: Set[int]
    ) -> InheritanceTreeNode:
        """
        Build tree node for a single page.

        Args:
            page: WebPage to build node for
            depth: Current depth in tree (0 = target page)
            visited: Set of visited page IDs (circular reference protection)
        """
        if page.id in visited:
            raise InheritanceTreeError(
                InheritanceTreeErrorCode.CIRCULAR_REFERENCE, {"page_id": page.id}
            )

        visited.add(page.id)

        # Build page metadata
        page_data = TreePageData(
            id=page.id,
            title=page.title,
            slug=page.slug,
            parent_id=page.parent_id,
            description=getattr(page, "description", None),
            layout=(
                page.get_effective_layout().name
                if page.get_effective_layout()
                else None
            ),
            theme=(
                page.get_effective_theme().name if page.get_effective_theme() else None
            ),
            hostname=(
                ",".join(page.hostnames)
                if hasattr(page, "hostnames") and page.hostnames
                else None
            ),
        )

        # Get all slots from effective layout
        effective_layout = page.get_effective_layout()
        slot_names = []
        if effective_layout and effective_layout.slot_configuration:
            slot_names = [
                slot["name"]
                for slot in effective_layout.slot_configuration.get("slots", [])
            ]

        # Ensure standard slots are always present
        standard_slots = ["header", "main", "sidebar", "footer"]
        all_slots = list(set(slot_names + standard_slots))

        # Build slots with widgets
        slots = {}
        for slot_name in all_slots:
            slots[slot_name] = self._get_slot_widgets(page, slot_name, depth)

        # Build parent node recursively
        parent_node = None
        if page.parent:
            parent_node = self._build_node(page.parent, depth + 1, visited.copy())

        return InheritanceTreeNode(
            page_id=page.id,
            depth=depth,
            page=page_data,
            slots=slots,
            parent=parent_node,
        )

    def _get_slot_widgets(
        self, page: WebPage, slot_name: str, depth: int
    ) -> List[TreeWidget]:
        """Get widgets for a specific slot from a specific page"""
        widgets = []

        # Get current published version
        current_version = page.get_current_published_version()
        if not current_version:
            current_version = page.get_latest_version()

        if not current_version or not current_version.widgets:
            return widgets

        # Get raw widgets for this slot
        raw_widgets = current_version.widgets.get(slot_name, [])

        for widget_data in raw_widgets:
            # Apply filters
            if not self._should_include_widget(widget_data, depth):
                continue

            # Convert to TreeWidget
            tree_widget = self._create_tree_widget(widget_data, depth)
            widgets.append(tree_widget)

        # Sort by order
        widgets.sort(key=lambda w: w.order)

        return widgets

    def _should_include_widget(self, widget_data: Dict, current_depth: int) -> bool:
        """Apply all widget filters to determine if widget should be included"""

        # 1. Publishing status
        if not widget_data.get("isPublished", widget_data.get("is_published", True)):
            return False

        # 2. Effective/expiry dates
        now = timezone.now()

        effective_date = widget_data.get("publishEffectiveDate") or widget_data.get(
            "publish_effective_date"
        )
        if effective_date:
            from datetime import datetime

            if isinstance(effective_date, str):
                try:
                    effective_date = datetime.fromisoformat(
                        effective_date.replace("Z", "+00:00")
                    )
                    if effective_date > now:
                        return False
                except ValueError:
                    pass  # Invalid date format, skip filter

        expire_date = widget_data.get("publishExpireDate") or widget_data.get(
            "publish_expire_date"
        )
        if expire_date:
            from datetime import datetime

            if isinstance(expire_date, str):
                try:
                    expire_date = datetime.fromisoformat(
                        expire_date.replace("Z", "+00:00")
                    )
                    if expire_date < now:
                        return False
                except ValueError:
                    pass  # Invalid date format, skip filter

        # 3. Inheritance level depth limits
        inheritance_level = widget_data.get(
            "inheritanceLevel", widget_data.get("inheritance_level", 0)
        )

        if inheritance_level == 0 and current_depth > 0:
            return False  # Widget only on its own page

        if inheritance_level > 0 and current_depth > inheritance_level:
            return False  # Beyond inheritance depth

        # -1 means infinite inheritance (always allowed)

        return True

    def _create_tree_widget(self, widget_data: Dict, depth: int) -> TreeWidget:
        """Convert raw widget data to TreeWidget with computed fields"""

        # Get inheritance behavior (with backward compatibility)
        inheritance_behavior = widget_data.get(
            "inheritanceBehavior"
        ) or widget_data.get("inheritance_behavior")
        if not inheritance_behavior:
            # Backward compatibility conversion
            inherit_from_parent = widget_data.get(
                "inheritFromParent", widget_data.get("inherit_from_parent", True)
            )
            override_parent = widget_data.get(
                "overrideParent", widget_data.get("override_parent", False)
            )

            if not inherit_from_parent:
                inheritance_behavior = WidgetInheritanceBehavior.OVERRIDE_PARENT
            elif override_parent:
                inheritance_behavior = WidgetInheritanceBehavior.OVERRIDE_PARENT
            else:
                inheritance_behavior = WidgetInheritanceBehavior.INSERT_AFTER_PARENT

        return TreeWidget(
            # Core widget data
            id=widget_data.get("id", ""),
            type=widget_data.get("type", ""),
            config=widget_data.get("config", {}),
            order=widget_data.get("order", 0),
            # Inheritance metadata
            depth=depth,
            inheritance_behavior=WidgetInheritanceBehavior(inheritance_behavior),
            is_published=widget_data.get(
                "isPublished", widget_data.get("is_published", True)
            ),
            inheritance_level=widget_data.get(
                "inheritanceLevel", widget_data.get("inheritance_level", 0)
            ),
            # Optional publishing fields
            publish_effective_date=widget_data.get("publishEffectiveDate")
            or widget_data.get("publish_effective_date"),
            publish_expire_date=widget_data.get("publishExpireDate")
            or widget_data.get("publish_expire_date"),
            # Computed fields (will be set by _add_computed_fields)
            is_local=depth == 0,
            is_inherited=depth > 0,
            can_be_overridden=True,  # Will be computed based on inheritance rules
        )

    def _add_computed_fields(self, tree: InheritanceTreeNode) -> None:
        """Add computed fields to all widgets in tree"""

        def process_node(node: InheritanceTreeNode) -> None:
            for slot_name, widgets in node.slots.items():
                for widget in widgets:
                    # Set computed flags
                    widget.is_local = widget.depth == 0
                    widget.is_inherited = widget.depth > 0
                    widget.can_be_overridden = self._can_widget_be_overridden(
                        widget, node
                    )

            # Process parent recursively
            if node.parent:
                process_node(node.parent)

        process_node(tree)

    def _can_widget_be_overridden(
        self, widget: TreeWidget, node: InheritanceTreeNode
    ) -> bool:
        """Determine if a widget can be overridden by child pages"""

        # Widgets with inheritance_level = 0 cannot be inherited (so cannot be overridden by children)
        if widget.inheritance_level == 0:
            return False

        # Widgets that are not published cannot be overridden (they're not visible)
        if not widget.is_published:
            return False

        # All other widgets can potentially be overridden
        return True

    def get_generation_time_ms(self) -> Optional[float]:
        """Get tree generation time in milliseconds"""
        if self._generation_start_time:
            return (time.time() - self._generation_start_time) * 1000
        return None

    def get_tree_statistics(self, tree: InheritanceTreeNode) -> TreeStatistics:
        """Generate statistics for the inheritance tree"""

        node_count = 0
        max_depth = 0
        total_widgets = 0
        slot_widget_counts = {}

        def analyze_node(node: InheritanceTreeNode) -> None:
            nonlocal node_count, max_depth, total_widgets

            node_count += 1
            max_depth = max(max_depth, node.depth)

            for slot_name, widgets in node.slots.items():
                if slot_name not in slot_widget_counts:
                    slot_widget_counts[slot_name] = 0
                slot_widget_counts[slot_name] += len(widgets)
                total_widgets += len(widgets)

            if node.parent:
                analyze_node(node.parent)

        analyze_node(tree)

        # Calculate slot utilization (percentage of nodes that have widgets in each slot)
        slot_utilization = {}
        for slot_name, widget_count in slot_widget_counts.items():
            slot_utilization[slot_name] = (
                (widget_count / node_count) * 100 if node_count > 0 else 0
            )

        average_widgets_per_slot = (
            total_widgets / len(slot_widget_counts) if slot_widget_counts else 0
        )

        return TreeStatistics(
            node_count=node_count,
            max_depth=max_depth,
            total_widgets=total_widgets,
            slot_utilization=slot_utilization,
            average_widgets_per_slot=average_widgets_per_slot,
            generation_time_ms=self.get_generation_time_ms(),
        )
