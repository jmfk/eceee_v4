"""
Tests for Widget Inheritance Tree Implementation

These tests verify that the Python inheritance tree implementation
behaves correctly and matches the canonical test cases.
"""

import json
from django.test import TestCase
from django.utils import timezone
from webpages.models import WebPage, PageVersion
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.inheritance_helpers import InheritanceTreeHelpers
from webpages.inheritance_types import WidgetInheritanceBehavior


class InheritanceTreeTest(TestCase):
    """Test inheritance tree generation and helper functions"""

    def setUp(self):
        """Create test page hierarchy: Home -> About -> History"""

        # Create Home page (root)
        self.home_page = WebPage.objects.create(
            title="Home", slug="home", parent=None, hostnames=["localhost:8000"]
        )
        home_version = PageVersion.objects.create(
            page=self.home_page,
            version_number=1,
            effective_date=timezone.now(),
            widgets={
                "header": [
                    {
                        "id": "home-header-1",
                        "type": "HeaderWidget",
                        "config": {"title": "Site Header"},
                        "inheritance_behavior": "insert_after_parent",
                        "is_published": True,
                        "inheritance_level": -1,
                        "order": 0,
                    }
                ],
                "sidebar": [
                    {
                        "id": "home-nav-1",
                        "type": "NavigationWidget",
                        "config": {"menu": ["Home", "About"]},
                        "inheritance_behavior": "insert_after_parent",
                        "is_published": True,
                        "inheritance_level": 1,
                        "order": 0,
                    }
                ],
            },
        )

        # Create About page (child of Home)
        self.about_page = WebPage.objects.create(
            title="About", slug="about", parent=self.home_page
        )
        about_version = PageVersion.objects.create(
            page=self.about_page,
            version_number=1,
            effective_date=timezone.now(),
            widgets={
                "main": [
                    {
                        "id": "about-content-1",
                        "type": "ContentWidget",
                        "config": {"content": "About page content"},
                        "inheritance_behavior": "insert_after_parent",
                        "is_published": True,
                        "inheritance_level": -1,
                        "order": 0,
                    }
                ],
                "sidebar": [
                    {
                        "id": "about-nav-1",
                        "type": "NavigationWidget",
                        "config": {"menu": ["About", "History"]},
                        "inheritance_behavior": "override_parent",
                        "is_published": True,
                        "inheritance_level": -1,
                        "order": 0,
                    }
                ],
            },
        )

        # Create History page (child of About)
        self.history_page = WebPage.objects.create(
            title="History", slug="history", parent=self.about_page
        )
        history_version = PageVersion.objects.create(
            page=self.history_page,
            version_number=1,
            effective_date=timezone.now(),
            widgets={
                "main": [
                    {
                        "id": "history-content-1",
                        "type": "ContentWidget",
                        "config": {"content": "History page content"},
                        "inheritance_behavior": "insert_after_parent",
                        "is_published": True,
                        "inheritance_level": -1,
                        "order": 0,
                    }
                ],
                "sidebar": [
                    {
                        "id": "history-sidebar-1",
                        "type": "ContentWidget",
                        "config": {"content": "History sidebar"},
                        "inheritance_behavior": "insert_before_parent",
                        "is_published": True,
                        "inheritance_level": -1,
                        "order": 0,
                    }
                ],
            },
        )

    def test_tree_generation(self):
        """Test basic tree structure generation"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)

        # Verify tree structure
        self.assertEqual(tree.page_id, self.history_page.id)
        self.assertEqual(tree.depth, 0)
        self.assertEqual(tree.page.title, "History")

        # Verify parent chain
        self.assertIsNotNone(tree.parent)
        self.assertEqual(tree.parent.page_id, self.about_page.id)
        self.assertEqual(tree.parent.depth, 1)

        self.assertIsNotNone(tree.parent.parent)
        self.assertEqual(tree.parent.parent.page_id, self.home_page.id)
        self.assertEqual(tree.parent.parent.depth, 2)

        self.assertIsNone(tree.parent.parent.parent)

    def test_get_all_widgets(self):
        """Test getAllWidgets helper function"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Test main slot - should have widgets from History and About
        main_widgets = helpers.get_all_widgets("main")
        self.assertEqual(len(main_widgets), 2)

        # First widget should be from current page (depth 0)
        self.assertEqual(main_widgets[0].id, "history-content-1")
        self.assertEqual(main_widgets[0].depth, 0)
        self.assertTrue(main_widgets[0].is_local)

        # Second widget should be from About page (depth 1)
        self.assertEqual(main_widgets[1].id, "about-content-1")
        self.assertEqual(main_widgets[1].depth, 1)
        self.assertTrue(main_widgets[1].is_inherited)

    def test_get_inherited_widgets(self):
        """Test getInheritedWidgets helper function"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Sidebar should have 1 inherited widget (About nav overrides Home nav)
        inherited = helpers.get_inherited_widgets("sidebar")
        self.assertEqual(len(inherited), 1)
        self.assertEqual(inherited[0].id, "about-nav-1")
        self.assertEqual(inherited[0].depth, 1)
        self.assertTrue(inherited[0].is_inherited)

    def test_inheritance_behavior_override(self):
        """Test override_parent behavior"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.about_page)  # Test from About page
        helpers = InheritanceTreeHelpers(tree)

        # About sidebar has override behavior - should only show About nav, not Home nav
        merged = helpers.get_merged_widgets("sidebar")
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].id, "about-nav-1")
        self.assertEqual(
            merged[0].inheritance_behavior, WidgetInheritanceBehavior.OVERRIDE_PARENT
        )

    def test_inheritance_behavior_insert_before(self):
        """Test insert_before_parent behavior"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # History sidebar has insert_before_parent behavior
        merged = helpers.get_merged_widgets("sidebar")
        self.assertEqual(len(merged), 2)

        # History widget should come first (insert_before_parent)
        self.assertEqual(merged[0].id, "history-sidebar-1")
        self.assertEqual(
            merged[0].inheritance_behavior,
            WidgetInheritanceBehavior.INSERT_BEFORE_PARENT,
        )

        # About widget should come second
        self.assertEqual(merged[1].id, "about-nav-1")

    def test_inheritance_level_filtering(self):
        """Test inheritance level depth filtering"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Home nav has inheritance_level=1, so shouldn't appear at History (depth 2)
        sidebar_widgets = helpers.get_all_widgets("sidebar")

        # Should only have History local widget and About inherited widget
        # Home nav should be filtered out due to inheritance_level=1
        widget_ids = [w.id for w in sidebar_widgets]
        self.assertIn("history-sidebar-1", widget_ids)
        self.assertIn("about-nav-1", widget_ids)
        self.assertNotIn("home-nav-1", widget_ids)  # Filtered out by inheritance level

    def test_content_checks(self):
        """Test content checking helper functions"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Test hasInheritedContent
        self.assertTrue(
            helpers.has_inherited_content("main")
        )  # About content inherited
        self.assertTrue(helpers.has_inherited_content("sidebar"))  # About nav inherited
        self.assertFalse(helpers.has_inherited_content("footer"))  # No footer widgets

        # Test hasLocalContent
        self.assertTrue(helpers.has_local_content("main"))  # History content
        self.assertTrue(helpers.has_local_content("sidebar"))  # History sidebar
        self.assertFalse(helpers.has_local_content("header"))  # No local header

    def test_find_widget(self):
        """Test findWidget helper function"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Find existing widget
        widget = helpers.find_widget("about-content-1")
        self.assertIsNotNone(widget)
        self.assertEqual(widget.id, "about-content-1")
        self.assertEqual(widget.type, "ContentWidget")
        self.assertEqual(widget.depth, 1)

        # Find non-existent widget
        missing = helpers.find_widget("nonexistent-widget")
        self.assertIsNone(missing)

    def test_tree_navigation(self):
        """Test tree navigation functions"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Test getRoot
        root = helpers.get_root()
        self.assertEqual(root.page_id, self.home_page.id)
        self.assertEqual(root.page.slug, "home")

        # Test getAncestors
        ancestors = helpers.get_ancestors()
        self.assertEqual(len(ancestors), 2)
        self.assertEqual(ancestors[0].page_id, self.about_page.id)
        self.assertEqual(ancestors[1].page_id, self.home_page.id)

        # Test traverseUp
        about_node = helpers.traverse_up(lambda node: node.page.slug == "about")
        self.assertIsNotNone(about_node)
        self.assertEqual(about_node.page_id, self.about_page.id)

    def test_widgets_by_type(self):
        """Test getWidgetsByType helper function"""
        builder = InheritanceTreeBuilder()
        tree = builder.build_tree(self.history_page)
        helpers = InheritanceTreeHelpers(tree)

        # Get all ContentWidgets
        content_widgets = helpers.get_widgets_by_type("ContentWidget")
        self.assertEqual(
            len(content_widgets), 3
        )  # History main, About main, History sidebar

        # Get ContentWidgets in main slot only
        main_content = helpers.get_widgets_by_type("ContentWidget", "main")
        self.assertEqual(len(main_content), 2)  # History and About main content

        # Get non-existent type
        missing_type = helpers.get_widgets_by_type("NonexistentWidget")
        self.assertEqual(len(missing_type), 0)

    def test_performance(self):
        """Test tree generation performance"""
        builder = InheritanceTreeBuilder()

        # Time tree generation
        import time

        start = time.time()
        tree = builder.build_tree(self.history_page)
        generation_time = (time.time() - start) * 1000

        # Should complete in under 50ms
        self.assertLess(
            generation_time, 50, "Tree generation should complete in under 50ms"
        )

        # Test statistics
        stats = builder.get_tree_statistics(tree)
        self.assertEqual(stats.node_count, 3)  # History, About, Home
        self.assertEqual(stats.max_depth, 2)  # Home is at depth 2
        self.assertGreater(stats.total_widgets, 0)
        self.assertIsNotNone(stats.generation_time_ms)
