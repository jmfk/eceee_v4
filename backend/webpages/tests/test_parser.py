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

    def test_script_tag_filtering(self):
        """Test that script tags are properly filtered and replaced with error messages."""
        from bs4 import BeautifulSoup

        # Test HTML with script tags
        test_html = """
        <div class="container">
            <h1>Test Page</h1>
            <script>
                alert('This should be blocked!');
                console.log('Malicious script');
            </script>
            <p>Regular content</p>
            <script src="https://malicious-site.com/script.js"></script>
        </div>
        """

        # Parse with BeautifulSoup
        soup = BeautifulSoup(test_html, "html.parser")

        # Find script tags
        script_tags = soup.find_all("script")
        self.assertEqual(len(script_tags), 2, "Should find 2 script tags in test HTML")

        # Test each script tag gets filtered
        for script_tag in script_tags:
            result = self.parser._parse_element(script_tag, test_html)

            # Verify script was replaced with error message
            self.assertEqual(result["type"], "element")
            self.assertEqual(result["tag"], "div")
            self.assertIn("script-blocked", result["classes"])
            self.assertIn("style", result["attributes"])
            self.assertEqual(len(result["children"]), 1)
            self.assertIn(
                "Script tag was removed for security reasons",
                result["children"][0]["content"],
            )

        # Test regular elements are not affected
        regular_elements = soup.find_all(["div", "h1", "p"])
        for element in regular_elements:
            result = self.parser._parse_element(element, test_html)
            if result and result.get("tag"):
                self.assertEqual(result["tag"], element.name)
                self.assertNotIn("script-blocked", result.get("classes", ""))

        print("✅ Script tag filtering test passed")

    def test_widget_script_tag_filtering(self):
        """Test that script tags are filtered in widget templates too."""
        from bs4 import BeautifulSoup

        # Test HTML with script tags in widget context
        test_html = """
        <div class="widget">
            <script>badCode();</script>
            <p>Widget content</p>
        </div>
        """

        soup = BeautifulSoup(test_html, "html.parser")
        script_tag = soup.find("script")

        # Test widget element parsing with WidgetTemplateParser
        from webpages.utils.template_parser import WidgetTemplateParser

        widget_parser = WidgetTemplateParser()
        result = widget_parser._parse_widget_element(script_tag, test_html)

        # Verify script was replaced with error message
        self.assertEqual(result["type"], "element")
        self.assertEqual(result["tag"], "div")
        self.assertIn("script-blocked", result["classes"])
        self.assertIn(
            "Script tag was removed for security reasons",
            result["children"][0]["content"],
        )

        print("✅ Widget script tag filtering test passed")
