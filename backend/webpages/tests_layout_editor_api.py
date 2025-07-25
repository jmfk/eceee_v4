"""
Tests for Enhanced Layout Template Serialization and Editor API

This module tests the new functionality that serializes code layout templates
and provides detailed JSON objects for the React editor.
"""

import json
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock

from webpages.layout_registry import BaseLayout, layout_registry, register_layout
from webpages.serializers import LayoutSerializer, EnhancedLayoutSerializer
from webpages.template_parser import LayoutTemplateParser


class TestLayoutTemplateParser(TestCase):
    """Test the LayoutTemplateParser functionality."""

    def setUp(self):
        """Set up test layout for parsing."""

        # Create a test layout
        @register_layout
        class TestLayout(BaseLayout):
            name = "test_layout"
            description = "Test layout for parsing"
            template_name = "webpages/layouts/single_column.html"
            css_classes = "layout-test"

            @property
            def slot_configuration(self):
                return {
                    "slots": [
                        {
                            "name": "header",
                            "title": "Header",
                            "description": "Header content",
                            "max_widgets": 2,
                            "css_classes": "slot-header",
                        },
                        {
                            "name": "main",
                            "title": "Main Content",
                            "description": "Main content area",
                            "max_widgets": None,
                            "css_classes": "slot-main",
                        },
                    ]
                }

        self.test_layout = layout_registry.get_layout("test_layout")
        self.parser = LayoutTemplateParser(self.test_layout)

    def tearDown(self):
        """Clean up after tests."""
        # Unregister test layout
        layout_registry.unregister("test_layout")

    def test_parser_initialization(self):
        """Test that parser initializes correctly."""
        self.assertIsNotNone(self.parser)
        self.assertEqual(self.parser.layout.name, "test_layout")
        self.assertIsNotNone(self.parser.template_content)
        self.assertIsNotNone(self.parser.parsed_soup)

    def test_get_template_structure(self):
        """Test template structure extraction."""
        structure = self.parser.get_template_structure()

        self.assertIsInstance(structure, dict)
        self.assertIn("root_element", structure)
        self.assertIn("template_type", structure)
        self.assertIn("parsing_metadata", structure)

        # Check metadata
        metadata = structure["parsing_metadata"]
        self.assertTrue(metadata["parsed_successfully"])
        self.assertEqual(
            metadata["template_name"], "webpages/layouts/single_column.html"
        )

    def test_get_slot_hierarchy(self):
        """Test slot hierarchy extraction."""
        hierarchy = self.parser.get_slot_hierarchy()

        self.assertIsInstance(hierarchy, dict)
        self.assertIn("total_slots", hierarchy)
        self.assertIn("slots", hierarchy)
        self.assertIn("layout_pattern", hierarchy)

        # Should find slots from the template
        self.assertGreaterEqual(hierarchy["total_slots"], 0)
        self.assertIsInstance(hierarchy["slots"], list)

    def test_get_css_analysis(self):
        """Test CSS analysis functionality."""
        css_analysis = self.parser.get_css_analysis()

        self.assertIsInstance(css_analysis, dict)
        self.assertIn("framework", css_analysis)
        self.assertIn("layout_classes", css_analysis)
        self.assertIn("responsive_classes", css_analysis)
        self.assertIn("grid_system", css_analysis)

    def test_get_editor_instructions(self):
        """Test editor instructions generation."""
        instructions = self.parser.get_editor_instructions()

        self.assertIsInstance(instructions, dict)
        self.assertIn("rendering", instructions)
        self.assertIn("editing", instructions)
        self.assertIn("preview", instructions)

        # Check rendering instructions
        rendering = instructions["rendering"]
        self.assertIn("container_setup", rendering)
        self.assertIn("slot_rendering", rendering)

    def test_get_layout_constraints(self):
        """Test layout constraints extraction."""
        constraints = self.parser.get_layout_constraints()

        self.assertIsInstance(constraints, dict)
        self.assertIn("slot_constraints", constraints)
        self.assertIn("layout_constraints", constraints)
        self.assertIn("editor_constraints", constraints)

        # Should have constraints for our test slots
        slot_constraints = constraints["slot_constraints"]
        self.assertIsInstance(slot_constraints, list)

    def test_get_validation_rules(self):
        """Test validation rules generation."""
        rules = self.parser.get_validation_rules()

        self.assertIsInstance(rules, dict)
        self.assertIn("required_slots", rules)
        self.assertIn("slot_widget_limits", rules)
        self.assertIn("css_validation", rules)
        self.assertIn("structure_validation", rules)


class TestEnhancedLayoutSerializer(TestCase):
    """Test the EnhancedLayoutSerializer functionality."""

    def setUp(self):
        """Set up test data."""

        # Create test layout
        @register_layout
        class SerializerTestLayout(BaseLayout):
            name = "serializer_test"
            description = "Test layout for serializer"
            template_name = "webpages/layouts/single_column.html"
            css_classes = "layout-serializer-test"

            @property
            def slot_configuration(self):
                return {
                    "slots": [
                        {
                            "name": "main",
                            "title": "Main Content",
                            "description": "Main content area",
                            "max_widgets": 5,
                            "css_classes": "slot-main",
                        }
                    ]
                }

        self.layout = layout_registry.get_layout("serializer_test")
        self.layout_data = self.layout.to_dict()

    def tearDown(self):
        """Clean up after tests."""
        layout_registry.unregister("serializer_test")

    def test_basic_serialization(self):
        """Test basic serialization without enhanced data."""
        serializer = LayoutSerializer(self.layout_data)
        data = serializer.data

        # Should have basic fields
        self.assertEqual(data["name"], "serializer_test")
        self.assertEqual(data["description"], "Test layout for serializer")
        self.assertIn("slot_configuration", data)

        # Should not have editor data by default
        self.assertIsNone(data.get("editor_data"))

    def test_enhanced_serialization_without_editor_data(self):
        """Test enhanced serializer without editor data context."""
        context = {"include_editor_data": False}
        serializer = EnhancedLayoutSerializer(self.layout_data, context=context)
        data = serializer.data

        # Should have basic fields
        self.assertEqual(data["name"], "serializer_test")
        # Should not have detailed editor data
        self.assertIsNone(data.get("editor_data"))

    @patch("webpages.template_parser.LayoutTemplateParser")
    def test_enhanced_serialization_with_editor_data(self, mock_parser_class):
        """Test enhanced serializer with editor data."""
        # Mock the parser
        mock_parser = MagicMock()
        mock_parser.get_template_structure.return_value = {"test": "structure"}
        mock_parser.get_slot_hierarchy.return_value = {"test": "hierarchy"}
        mock_parser.get_css_analysis.return_value = {"test": "css"}
        mock_parser.get_editor_instructions.return_value = {"test": "instructions"}
        mock_parser.get_layout_constraints.return_value = {"test": "constraints"}
        mock_parser.get_responsive_info.return_value = {"test": "responsive"}
        mock_parser.get_accessibility_info.return_value = {"test": "accessibility"}
        mock_parser.get_validation_rules.return_value = {"test": "validation"}

        mock_parser_class.return_value = mock_parser

        context = {"include_editor_data": True}
        serializer = EnhancedLayoutSerializer(self.layout_data, context=context)
        data = serializer.data

        # Should have editor data
        self.assertIsNotNone(data.get("editor_data"))
        editor_data = data["editor_data"]

        # Should have all expected sections
        self.assertIn("template_structure", editor_data)
        self.assertIn("slot_hierarchy", editor_data)
        self.assertIn("css_analysis", editor_data)
        self.assertIn("editor_instructions", editor_data)
        self.assertIn("constraints", editor_data)
        self.assertIn("responsive_breakpoints", editor_data)
        self.assertIn("accessibility_info", editor_data)
        self.assertIn("validation_rules", editor_data)

    def test_fallback_editor_data(self):
        """Test fallback editor data when parser fails."""
        context = {"include_editor_data": True}

        # This should trigger the fallback implementation
        serializer = EnhancedLayoutSerializer(self.layout_data, context=context)
        data = serializer.data

        # Should have basic editor data
        self.assertIsNotNone(data.get("editor_data"))
        editor_data = data["editor_data"]

        # Should have fallback structure (check that some editor data exists)
        self.assertIsInstance(editor_data, dict)
        self.assertIn("slot_summary", editor_data)
        self.assertIn("editor_metadata", editor_data)
        self.assertIn("basic_structure", editor_data)

        # Check slot summary
        slot_summary = editor_data["slot_summary"]
        self.assertEqual(slot_summary["total_slots"], 1)
        self.assertIsInstance(slot_summary["slots"], list)

        # Check first slot
        first_slot = slot_summary["slots"][0]
        self.assertEqual(first_slot["name"], "main")
        self.assertEqual(first_slot["title"], "Main Content")
        self.assertEqual(first_slot["max_widgets"], 5)


class TestLayoutEditorAPIEndpoints(TestCase):
    """Test the new API endpoints for layout editor functionality."""

    def setUp(self):
        """Set up test client and data."""
        self.client = APIClient()

        # Create test layout
        @register_layout
        class APITestLayout(BaseLayout):
            name = "api_test"
            description = "Test layout for API"
            template_name = "webpages/layouts/single_column.html"
            css_classes = "layout-api-test"

            @property
            def slot_configuration(self):
                return {
                    "slots": [
                        {
                            "name": "header",
                            "title": "Header",
                            "description": "Header area",
                            "max_widgets": 2,
                        },
                        {
                            "name": "content",
                            "title": "Content",
                            "description": "Main content",
                            "max_widgets": None,
                        },
                    ]
                }

        self.layout_name = "api_test"

    def tearDown(self):
        """Clean up after tests."""
        layout_registry.unregister("api_test")

    def test_editor_data_endpoint(self):
        """Test the editor-data endpoint."""
        url = f"/api/code-layouts/{self.layout_name}/editor-data/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("layout", data)
        self.assertIn("editor_meta", data)

        # Check layout data
        layout_data = data["layout"]
        self.assertEqual(layout_data["name"], self.layout_name)
        self.assertIn("editor_data", layout_data)

        # Check editor metadata
        editor_meta = data["editor_meta"]
        self.assertEqual(editor_meta["optimized_for"], "react_editor")
        self.assertIn("api_version", editor_meta)

    def test_editor_data_endpoint_not_found(self):
        """Test editor-data endpoint with non-existent layout."""
        url = f"/api/code-layouts/non_existent/editor-data/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        data = response.json()
        self.assertIn("error", data)

    def test_editor_list_endpoint(self):
        """Test the editor-list endpoint."""
        url = "/api/code-layouts/editor-list/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("results", data)
        self.assertIn("editor_meta", data)

        # Should have our test layout
        results = data["results"]
        self.assertIsInstance(results, list)

        # Find our test layout
        test_layout = next(
            (layout for layout in results if layout["name"] == self.layout_name), None
        )
        self.assertIsNotNone(test_layout)
        self.assertIn("editor_data", test_layout)

        # Check editor metadata
        editor_meta = data["editor_meta"]
        self.assertEqual(editor_meta["optimized_for"], "react_editor")
        self.assertIn("data_includes", editor_meta)
        self.assertIn("template_structure", editor_meta["data_includes"])

    def test_editor_list_endpoint_active_only(self):
        """Test editor-list endpoint with active_only parameter."""
        url = "/api/code-layouts/editor-list/"
        response = self.client.get(url, {"active_only": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("results", data)

        # All returned layouts should be active
        for layout in data["results"]:
            self.assertTrue(layout.get("is_active", True))

    def test_regular_endpoints_still_work(self):
        """Test that regular layout endpoints still work without editor data."""
        # Test list endpoint
        url = "/api/code-layouts/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Should not have editor data in regular endpoint
        for layout in data["results"]:
            self.assertIsNone(layout.get("editor_data"))

        # Test detail endpoint
        url = f"/api/code-layouts/{self.layout_name}/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        layout_data = response.json()

        # Should not have editor data in regular endpoint
        self.assertIsNone(layout_data.get("editor_data"))


class TestLayoutInferenceHelpers(TestCase):
    """Test the helper methods for layout inference."""

    def setUp(self):
        """Set up test serializer."""
        self.serializer = LayoutSerializer()

    def test_infer_layout_type(self):
        """Test layout type inference."""
        # Test single column
        layout_type = self.serializer._infer_layout_type("single_column", 2)
        self.assertEqual(layout_type, "single_column")

        # Test two column
        layout_type = self.serializer._infer_layout_type("two_column_layout", 3)
        self.assertEqual(layout_type, "two_column")

        # Test three column
        layout_type = self.serializer._infer_layout_type("three_column_complex", 4)
        self.assertEqual(layout_type, "three_column")

        # Test grid
        layout_type = self.serializer._infer_layout_type("grid_layout", 6)
        self.assertEqual(layout_type, "grid")

        # Test hero
        layout_type = self.serializer._infer_layout_type("hero_landing", 3)
        self.assertEqual(layout_type, "hero")

        # Test custom
        layout_type = self.serializer._infer_layout_type("custom_layout", 5)
        self.assertEqual(layout_type, "custom")

    def test_get_use_cases(self):
        """Test use case recommendations."""
        # Test single column
        use_cases = self.serializer._get_use_cases("single_column", 2)
        self.assertIn("blog_posts", use_cases)
        self.assertIn("articles", use_cases)

        # Test two column
        use_cases = self.serializer._get_use_cases("two_column", 3)
        self.assertIn("documentation", use_cases)

        # Test hero
        use_cases = self.serializer._get_use_cases("hero_layout", 3)
        self.assertIn("landing_pages", use_cases)
        self.assertIn("marketing_pages", use_cases)

    def test_infer_slot_layout(self):
        """Test slot layout pattern inference."""
        # Test single slot
        slots = [{"name": "main"}]
        pattern = self.serializer._infer_slot_layout(slots)
        self.assertEqual(pattern, "single")

        # Test vertical layout (with footer)
        slots = [{"name": "main"}, {"name": "footer"}]
        pattern = self.serializer._infer_slot_layout(slots)
        self.assertEqual(pattern, "vertical")

        # Test horizontal layout
        slots = [{"name": "main"}, {"name": "sidebar"}]
        pattern = self.serializer._infer_slot_layout(slots)
        self.assertEqual(pattern, "horizontal")

        # Test header/main/footer pattern
        slots = [{"name": "header"}, {"name": "main"}, {"name": "footer"}]
        pattern = self.serializer._infer_slot_layout(slots)
        self.assertEqual(pattern, "header_main_footer")

        # Test complex grid
        slots = [{"name": f"slot_{i}"} for i in range(5)]
        pattern = self.serializer._infer_slot_layout(slots)
        self.assertEqual(pattern, "complex_grid")


if __name__ == "__main__":
    import unittest

    unittest.main()
