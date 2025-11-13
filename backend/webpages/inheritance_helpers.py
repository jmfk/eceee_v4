"""
Widget Inheritance Tree Helper Functions

Helper functions for querying widget inheritance trees. These functions
must match the TypeScript implementation exactly for cross-platform consistency.
"""

from typing import List, Optional, Dict, Any
from .inheritance_types import (
    InheritanceTreeNode,
    TreeWidget,
    WidgetInheritanceBehavior,
    MergeOptions,
    SlotQueryOptions,
    TreeNodePredicate,
    WidgetPredicate,
    InheritanceTreeError,
    InheritanceTreeErrorCode,
    InheritanceAnalysis,
)


class InheritanceTreeHelpers:
    """Helper functions for inheritance tree queries"""

    def __init__(self, tree: InheritanceTreeNode):
        self.tree = tree

    # Core Query Functions

    def get_all_widgets(self, slot_name: str) -> List[TreeWidget]:
        """
        Get all widgets in the specified slot from ALL tree levels.

        Args:
            slot_name: Name of the slot to query

        Returns:
            List of widgets ordered by depth (current page first)
        """
        widgets = []

        def collect_from_node(node: InheritanceTreeNode) -> None:
            if slot_name in node.slots:
                widgets.extend(node.slots[slot_name])
            if node.parent:
                collect_from_node(node.parent)

        collect_from_node(self.tree)

        # Sort by depth (current page first)
        widgets.sort(key=lambda w: w.depth)

        return widgets

    def get_widgets_by_type(
        self, widget_type: str, slot_name: Optional[str] = None
    ) -> List[TreeWidget]:
        """
        Get all widgets of the specified type.

        Args:
            widget_type: Widget type to filter by
            slot_name: Optional slot name to filter by

        Returns:
            List of matching widgets
        """
        widgets = []

        def collect_from_node(node: InheritanceTreeNode) -> None:
            slots_to_check = [slot_name] if slot_name else node.slots.keys()

            for slot in slots_to_check:
                if slot in node.slots:
                    for widget in node.slots[slot]:
                        if widget.type == widget_type:
                            widgets.append(widget)

            if node.parent:
                collect_from_node(node.parent)

        collect_from_node(self.tree)

        # Sort by depth, then by order
        widgets.sort(key=lambda w: (w.depth, w.order))

        return widgets

    def get_inherited_widgets(self, slot_name: str) -> List[TreeWidget]:
        """
        Get only inherited widgets (depth > 0) for the specified slot.

        Args:
            slot_name: Name of the slot to query

        Returns:
            List of inherited widgets only
        """
        all_widgets = self.get_all_widgets(slot_name)
        return [w for w in all_widgets if w.is_inherited]

    def get_local_widgets(self, slot_name: str) -> List[TreeWidget]:
        """
        Get only local widgets (depth === 0) for the specified slot.

        Args:
            slot_name: Name of the slot to query

        Returns:
            List of local widgets only
        """
        if slot_name in self.tree.slots:
            return [w for w in self.tree.slots[slot_name] if w.is_local]
        return []

    def get_widgets_at_depth(
        self, depth: int, slot_name: Optional[str] = None
    ) -> List[TreeWidget]:
        """
        Get widgets from specific inheritance depth.

        Args:
            depth: Inheritance depth (0 = current page, 1 = parent, etc.)
            slot_name: Optional slot name to filter by

        Returns:
            List of widgets at the specified depth
        """
        widgets = []

        def collect_from_node(node: InheritanceTreeNode) -> None:
            if node.depth == depth:
                slots_to_check = [slot_name] if slot_name else node.slots.keys()
                for slot in slots_to_check:
                    if slot in node.slots:
                        widgets.extend(node.slots[slot])

            if node.parent:
                collect_from_node(node.parent)

        collect_from_node(self.tree)

        # Sort by order
        widgets.sort(key=lambda w: w.order)

        return widgets

    # Inheritance Logic Functions

    def get_merged_widgets(
        self, slot_name: str, options: Optional[MergeOptions] = None
    ) -> List[TreeWidget]:
        """
        Get widgets for display, applying inheritance behavior rules.

        Args:
            slot_name: Name of the slot
            options: Merge options for behavior control

        Returns:
            List of widgets for display, properly ordered by inheritance behavior
        """
        if not options:
            options = MergeOptions()

        all_widgets = self.get_all_widgets(slot_name)

        # Apply publishing filter if requested
        if options.respect_publishing:
            all_widgets = [w for w in all_widgets if w.is_published]

        if not options.apply_inheritance_behavior:
            return all_widgets

        # Group widgets by inheritance behavior
        override_widgets = [
            w
            for w in all_widgets
            if w.inheritance_behavior == WidgetInheritanceBehavior.OVERRIDE_PARENT
        ]
        before_widgets = [
            w
            for w in all_widgets
            if w.inheritance_behavior == WidgetInheritanceBehavior.INSERT_BEFORE_PARENT
        ]
        after_widgets = [
            w
            for w in all_widgets
            if w.inheritance_behavior == WidgetInheritanceBehavior.INSERT_AFTER_PARENT
        ]

        # Apply inheritance behavior logic
        if override_widgets:
            # Override widgets replace ALL other widgets
            result = sorted(override_widgets, key=lambda w: (w.depth, w.order))
            return result

        # Combine: before + inherited (after) widgets
        # Note: "inherited" widgets are those with INSERT_AFTER_PARENT behavior
        result = []

        # Add before widgets (sorted by depth, then order)
        before_sorted = sorted(before_widgets, key=lambda w: (w.depth, w.order))
        result.extend(before_sorted)

        # Add after widgets (sorted by depth, then order)
        after_sorted = sorted(after_widgets, key=lambda w: (w.depth, w.order))
        result.extend(after_sorted)

        return result

    def get_widgets_by_behavior(
        self, behavior: WidgetInheritanceBehavior, slot_name: Optional[str] = None
    ) -> List[TreeWidget]:
        """
        Get widgets with specific inheritance behavior.

        Args:
            behavior: Inheritance behavior to filter by
            slot_name: Optional slot name to filter by

        Returns:
            List of widgets with matching behavior
        """
        widgets = []

        def collect_from_node(node: InheritanceTreeNode) -> None:
            slots_to_check = [slot_name] if slot_name else node.slots.keys()

            for slot in slots_to_check:
                if slot in node.slots:
                    for widget in node.slots[slot]:
                        if widget.inheritance_behavior == behavior:
                            widgets.append(widget)

            if node.parent:
                collect_from_node(node.parent)

        collect_from_node(self.tree)

        return sorted(widgets, key=lambda w: (w.depth, w.order))

    # Content Check Functions

    def has_inherited_content(self, slot_name: str) -> bool:
        """Check if slot has any inherited content"""
        inherited = self.get_inherited_widgets(slot_name)
        return len(inherited) > 0

    def has_local_content(self, slot_name: str) -> bool:
        """Check if slot has any local content"""
        local = self.get_local_widgets(slot_name)
        return len(local) > 0

    def has_content_at_depth(self, slot_name: str, depth: int) -> bool:
        """Check if slot has content at specific depth"""
        widgets = self.get_widgets_at_depth(depth, slot_name)
        return len(widgets) > 0

    # Tree Navigation Functions

    def traverse_up(
        self, predicate: TreeNodePredicate
    ) -> Optional[InheritanceTreeNode]:
        """
        Traverse up the tree until predicate is met.

        Args:
            predicate: Function that returns True when target node found

        Returns:
            First node matching predicate, or None if not found
        """
        current = self.tree

        while current:
            if predicate(current):
                return current
            current = current.parent

        return None

    def get_ancestors(self) -> List[InheritanceTreeNode]:
        """Get all ancestor nodes (excluding current page)"""
        ancestors = []
        current = self.tree.parent

        while current:
            ancestors.append(current)
            current = current.parent

        return ancestors

    def get_root(self) -> InheritanceTreeNode:
        """Get the root node (deepest ancestor)"""
        current = self.tree

        while current.parent:
            current = current.parent

        return current

    # Advanced Query Functions

    def find_widget(self, widget_id: str) -> Optional[TreeWidget]:
        """
        Find widget by ID across entire tree.

        Args:
            widget_id: Widget ID to search for

        Returns:
            Widget if found, None otherwise
        """

        def search_node(node: InheritanceTreeNode) -> Optional[TreeWidget]:
            for slot_widgets in node.slots.values():
                for widget in slot_widgets:
                    if widget.id == widget_id:
                        return widget

            if node.parent:
                return search_node(node.parent)

            return None

        return search_node(self.tree)

    def get_slot_at_depth(self, slot_name: str, depth: int) -> List[TreeWidget]:
        """
        Get widgets from specific slot at specific depth.

        Args:
            slot_name: Name of the slot
            depth: Depth level to query

        Returns:
            List of widgets from that slot at that depth
        """

        def find_node_at_depth(
            node: InheritanceTreeNode,
        ) -> Optional[InheritanceTreeNode]:
            if node.depth == depth:
                return node
            if node.parent:
                return find_node_at_depth(node.parent)
            return None

        target_node = find_node_at_depth(self.tree)
        if target_node and slot_name in target_node.slots:
            return target_node.slots[slot_name]

        return []

    # Analysis Functions

    def analyze_inheritance(
        self, slot_name: Optional[str] = None
    ) -> InheritanceAnalysis:
        """
        Analyze inheritance patterns for debugging and monitoring.

        Args:
            slot_name: Optional slot to analyze, or None for all slots

        Returns:
            InheritanceAnalysis with statistics
        """
        widgets = []

        if slot_name:
            widgets = self.get_all_widgets(slot_name)
        else:
            # Get all widgets from all slots
            def collect_all(node: InheritanceTreeNode) -> None:
                for slot_widgets in node.slots.values():
                    widgets.extend(slot_widgets)
                if node.parent:
                    collect_all(node.parent)

            collect_all(self.tree)

        # Calculate distributions
        depth_dist = {}
        type_dist = {}
        behavior_dist = {}

        local_count = 0
        inherited_count = 0

        for widget in widgets:
            # Depth distribution
            depth_dist[widget.depth] = depth_dist.get(widget.depth, 0) + 1

            # Type distribution
            type_dist[widget.type] = type_dist.get(widget.type, 0) + 1

            # Behavior distribution
            behavior_dist[widget.inheritance_behavior] = (
                behavior_dist.get(widget.inheritance_behavior, 0) + 1
            )

            # Local vs inherited
            if widget.is_local:
                local_count += 1
            else:
                inherited_count += 1

        return InheritanceAnalysis(
            total_widgets=len(widgets),
            local_widgets=local_count,
            inherited_widgets=inherited_count,
            depth_distribution=depth_dist,
            type_distribution=type_dist,
            behavior_distribution=behavior_dist,
        )


# Convenience functions that create helper instance internally
def build_inheritance_tree(page) -> InheritanceTreeNode:
    """Build inheritance tree for a page"""
    builder = InheritanceTreeBuilder()
    return builder.build_tree(page)


def get_tree_helpers(tree: InheritanceTreeNode) -> InheritanceTreeHelpers:
    """Get helper functions for a tree"""
    return InheritanceTreeHelpers(tree)


# Direct helper functions with caching
def get_all_widgets_for_page(page, slot_name: str) -> List[TreeWidget]:
    """Get all widgets for a slot from a page's inheritance tree (cached)"""
    from .inheritance_cache import get_cached_tree

    tree = get_cached_tree(page.id)
    helpers = get_tree_helpers(tree)
    return helpers.get_all_widgets(slot_name)


def get_merged_widgets_for_page(
    page, slot_name: str, options: Optional[MergeOptions] = None
) -> List[TreeWidget]:
    """Get merged widgets for display from a page's inheritance tree"""
    tree = build_inheritance_tree(page)
    helpers = get_tree_helpers(tree)
    return helpers.get_merged_widgets(slot_name, options)


def has_inherited_content_for_page(page, slot_name: str) -> bool:
    """Check if page has inherited content in slot"""
    tree = build_inheritance_tree(page)
    helpers = get_tree_helpers(tree)
    return helpers.has_inherited_content(slot_name)
