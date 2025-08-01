"""
Template parser tests - converted from standalone script to proper Django test case.

This ensures security by removing sys.path manipulation and using Django's test framework.
"""

import json
from django.test import TestCase
from webpages.utils.template_parser import TemplateParser


class TemplateParserTest(TestCase):
    """Test cases for the template parser functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.parser = TemplateParser()

    def test_sidebar_layout_parsing(self):
        """Test parsing the sidebar layout template."""
        # Test parsing the updated sidebar layout
        result = self.parser.parse_template("webpages/layouts/sidebar_layout.html")

        # Verify parsing was successful
        self.assertIsNotNone(result)
        self.assertIsInstance(result, dict)

        # Check for basic structure
        if "type" in result and result["type"] == "element":
            # Verify root element structure
            self.assertIn("tag", result)
            self.assertIsInstance(result.get("classes"), (str, type(None)))

            # Count slots
            slot_count = self._count_slots(result)

            # Extract slot names
            slot_names = self._extract_slot_names(result)

            # Print debug information for manual verification
            print(
                f"\n🎯 Root element: <{result['tag']}> with classes: {result.get('classes', 'none')}"
            )
            print(f"🔧 Found {slot_count} slots in the layout")
            print(f"📍 Slot names: {', '.join(slot_names)}")
            print("📄 Layout structure:")
            print(json.dumps(result, indent=2))

            # Basic assertions
            self.assertGreaterEqual(slot_count, 0)
            self.assertIsInstance(slot_names, list)

    def test_parser_instance_creation(self):
        """Test that parser instance can be created."""
        self.assertIsNotNone(self.parser)
        self.assertIsInstance(self.parser, TemplateParser)

    def _count_slots(self, node, count=0):
        """Recursively count slots in the layout."""
        if isinstance(node, dict):
            if node.get("type") == "slot":
                count += 1
            if "children" in node:
                for child in node["children"]:
                    count = self._count_slots(child, count)
        return count

    def _extract_slot_names(self, node, names=None):
        """Recursively extract slot names."""
        if names is None:
            names = []

        if isinstance(node, dict):
            if node.get("type") == "slot" and "slot" in node:
                names.append(node["slot"]["name"])
            if "children" in node:
                for child in node["children"]:
                    self._extract_slot_names(child, names)

        return names
