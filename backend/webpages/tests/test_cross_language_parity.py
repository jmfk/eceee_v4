"""
Cross-Language Parity Tests

These tests verify that Python and TypeScript inheritance tree implementations
return identical results for the same input data.
"""

import json
import os
from django.test import TestCase
from django.utils import timezone
from webpages.models import WebPage, PageVersion
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.inheritance_helpers import InheritanceTreeHelpers


class CrossLanguageParityTest(TestCase):
    """Test that Python implementation matches canonical test results"""

    def setUp(self):
        """Load canonical test data"""
        test_data_path = os.path.join(
            os.path.dirname(__file__), "../../../docs/inheritance-tree-test-data.json"
        )

        with open(test_data_path, "r") as f:
            self.test_data = json.load(f)

        # Create pages from test data
        self.pages = {}
        self.create_test_pages()

    def create_test_pages(self):
        """Create WebPage objects from test data"""

        # Create pages for basic_hierarchy test case
        basic_test = self.test_data["testCases"]["basic_hierarchy"]

        for page_id, page_data in basic_test["pages"].items():
            # Create WebPage
            parent = (
                self.pages.get(str(page_data["parent_id"]))
                if page_data.get("parent_id")
                else None
            )

            page = WebPage.objects.create(
                id=int(page_id),
                title=page_data["title"],
                slug=page_data["slug"],
                parent=parent,
                hostnames=["localhost:8000"] if not parent else [],
            )

            # Create PageVersion with widgets
            PageVersion.objects.create(
                page=page,
                version_number=1,
                effective_date=timezone.now(),
                widgets=page_data["widgets"],
            )

            self.pages[page_id] = page

    def test_get_all_widgets_parity(self):
        """Test getAllWidgets matches expected results"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Test main slot
        main_widgets = helpers.get_all_widgets("main")
        expected = self.test_data["testCases"]["basic_hierarchy"]["expectedResults"][
            "pageId4_getAllWidgets_main"
        ]

        self.assertEqual(len(main_widgets), len(expected))

        for i, widget in enumerate(main_widgets):
            self.assertEqual(widget.id, expected[i]["id"])
            self.assertEqual(widget.depth, expected[i]["depth"])
            self.assertEqual(widget.is_local, expected[i]["isLocal"])
            self.assertEqual(widget.is_inherited, expected[i]["isInherited"])

    def test_get_inherited_widgets_parity(self):
        """Test getInheritedWidgets matches expected results"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)
        helpers = InheritanceTreeHelpers(tree)

        inherited = helpers.get_inherited_widgets("sidebar")
        expected = self.test_data["testCases"]["basic_hierarchy"]["expectedResults"][
            "pageId4_getInheritedWidgets_sidebar"
        ]

        self.assertEqual(len(inherited), len(expected))

        for i, widget in enumerate(inherited):
            self.assertEqual(widget.id, expected[i]["id"])
            self.assertEqual(widget.depth, expected[i]["depth"])
            self.assertTrue(widget.is_inherited)

    def test_get_merged_widgets_parity(self):
        """Test getMergedWidgets behavior ordering"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)
        helpers = InheritanceTreeHelpers(tree)

        merged = helpers.get_merged_widgets("sidebar")
        expected = self.test_data["testCases"]["basic_hierarchy"]["expectedResults"][
            "pageId4_getMergedWidgets_sidebar"
        ]

        self.assertEqual(len(merged), len(expected))

        # Verify order based on inheritance behavior
        self.assertEqual(merged[0].id, expected[0]["id"])  # insert_before_parent first
        self.assertEqual(merged[1].id, expected[1]["id"])  # override_parent second

    def test_has_inherited_content_parity(self):
        """Test hasInheritedContent boolean checks"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Main slot has inherited content
        has_main = helpers.has_inherited_content("main")
        expected_main = self.test_data["testCases"]["basic_hierarchy"][
            "expectedResults"
        ]["pageId4_hasInheritedContent_main"]
        self.assertEqual(has_main, expected_main)

        # Footer slot has no inherited content
        has_footer = helpers.has_inherited_content("footer")
        expected_footer = self.test_data["testCases"]["basic_hierarchy"][
            "expectedResults"
        ]["pageId4_hasInheritedContent_footer"]
        self.assertEqual(has_footer, expected_footer)

    def test_get_widgets_at_depth_parity(self):
        """Test getWidgetsAtDepth filtering"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)
        helpers = InheritanceTreeHelpers(tree)

        depth_one = helpers.get_widgets_at_depth(1)
        expected = self.test_data["testCases"]["basic_hierarchy"]["expectedResults"][
            "pageId4_getWidgetsAtDepth_1"
        ]

        self.assertEqual(len(depth_one), len(expected))

        # Convert to simple format for comparison
        actual_data = [
            {
                "id": w.id,
                "depth": w.depth,
                "slotName": self._find_slot_for_widget(tree, w.id),
            }
            for w in depth_one
        ]

        # Sort by id for consistent comparison
        actual_data.sort(key=lambda x: x["id"])
        expected_sorted = sorted(expected, key=lambda x: x["id"])

        for i, item in enumerate(actual_data):
            self.assertEqual(item["id"], expected_sorted[i]["id"])
            self.assertEqual(item["depth"], expected_sorted[i]["depth"])

    def _find_slot_for_widget(self, tree, widget_id):
        """Helper to find which slot contains a widget"""

        def search_node(node):
            for slot_name, widgets in node.slots.items():
                for widget in widgets:
                    if widget.id == widget_id:
                        return slot_name
            if node.parent:
                return search_node(node.parent)
            return None

        return search_node(tree)

    def test_json_serialization_compatibility(self):
        """Test that tree can be serialized to JSON for frontend compatibility"""
        history_page = self.pages["4"]
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(history_page)

        # Convert tree to JSON format (as API would do)
        def serialize_tree(node):
            return {
                "pageId": node.page_id,
                "depth": node.depth,
                "page": {
                    "id": node.page.id,
                    "title": node.page.title,
                    "slug": node.page.slug,
                    "parentId": node.page.parent_id,
                },
                "slots": {
                    slot_name: [
                        {
                            "id": widget.id,
                            "type": widget.type,
                            "config": widget.config,
                            "depth": widget.depth,
                            "inheritanceBehavior": widget.inheritance_behavior.value,
                            "isLocal": widget.is_local,
                            "isInherited": widget.is_inherited,
                        }
                        for widget in widgets
                    ]
                    for slot_name, widgets in node.slots.items()
                },
                "parent": serialize_tree(node.parent) if node.parent else None,
            }

        tree_json = serialize_tree(tree)

        # Should be JSON serializable
        json_string = json.dumps(tree_json)
        self.assertIsNotNone(json_string)

        # Should be deserializable
        parsed = json.loads(json_string)
        self.assertEqual(parsed["pageId"], tree.page_id)
        self.assertEqual(parsed["page"]["title"], tree.page.title)

    def test_error_handling_consistency(self):
        """Test that error handling matches TypeScript behavior"""
        from webpages.inheritance_types import (
            InheritanceTreeError,
            InheritanceTreeErrorCode,
        )

        # Test circular reference detection
        # Create circular reference: Page A -> Page B -> Page A
        page_a = WebPage.objects.create(title="Page A", slug="page-a")
        page_b = WebPage.objects.create(title="Page B", slug="page-b", parent=page_a)

        # This would create a circular reference
        page_a.parent = page_b
        page_a.save()

        builder = InheritanceTreeBuilder()

        with self.assertRaises(InheritanceTreeError) as cm:
            builder.build_tree(page_a)

        self.assertEqual(cm.exception.code, InheritanceTreeErrorCode.CIRCULAR_REFERENCE)
