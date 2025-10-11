"""
Tests for Common Path Patterns

Tests the predefined path patterns to ensure they match expected URLs correctly.
"""

from django.test import TestCase

from ..path_pattern_registry import path_pattern_registry


class CommonPathPatternsTests(TestCase):
    """Test cases for the common path patterns"""

    def test_news_slug_pattern(self):
        """Test the news_slug pattern"""
        pattern = path_pattern_registry.get_pattern("news_slug")
        self.assertIsNotNone(pattern)

        # Test valid matches
        result = pattern.validate_match("my-article/")
        self.assertEqual(result, {"slug": "my-article"})

        result = pattern.validate_match("news-2025/")
        self.assertEqual(result, {"slug": "news-2025"})

        # Test invalid matches
        self.assertIsNone(pattern.validate_match("invalid path"))
        self.assertIsNone(pattern.validate_match("no-trailing-slash"))

    def test_event_slug_pattern(self):
        """Test the event_slug pattern"""
        pattern = path_pattern_registry.get_pattern("event_slug")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("summer-conference-2025/")
        self.assertEqual(result, {"slug": "summer-conference-2025"})

    def test_library_slug_pattern(self):
        """Test the library_slug pattern"""
        pattern = path_pattern_registry.get_pattern("library_slug")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("energy-efficiency-report-2025/")
        self.assertEqual(result, {"slug": "energy-efficiency-report-2025"})

    def test_member_slug_pattern(self):
        """Test the member_slug pattern"""
        pattern = path_pattern_registry.get_pattern("member_slug")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("john-doe/")
        self.assertEqual(result, {"slug": "john-doe"})

    def test_date_slug_pattern(self):
        """Test the date_slug pattern"""
        pattern = path_pattern_registry.get_pattern("date_slug")
        self.assertIsNotNone(pattern)

        # Test valid date-based URL
        result = pattern.validate_match("2025/10/my-article/")
        self.assertEqual(
            result,
            {
                "year": "2025",
                "month": "10",
                "slug": "my-article",
            },
        )

        # Test another valid date
        result = pattern.validate_match("2024/01/winter-update/")
        self.assertEqual(
            result,
            {
                "year": "2024",
                "month": "01",
                "slug": "winter-update",
            },
        )

        # Test invalid formats
        self.assertIsNone(
            pattern.validate_match("2025/1/article/")
        )  # Single digit month
        self.assertIsNone(pattern.validate_match("25/10/article/"))  # Two digit year

    def test_year_slug_pattern(self):
        """Test the year_slug pattern"""
        pattern = path_pattern_registry.get_pattern("year_slug")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("2025/annual-report/")
        self.assertEqual(
            result,
            {
                "year": "2025",
                "slug": "annual-report",
            },
        )

    def test_numeric_id_pattern(self):
        """Test the numeric_id pattern"""
        pattern = path_pattern_registry.get_pattern("numeric_id")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("12345/")
        self.assertEqual(result, {"id": "12345"})

        # Test that it doesn't match non-numeric
        self.assertIsNone(pattern.validate_match("abc/"))

    def test_category_slug_pattern(self):
        """Test the category_slug pattern"""
        pattern = path_pattern_registry.get_pattern("category_slug")
        self.assertIsNotNone(pattern)

        result = pattern.validate_match("technology/energy-efficiency/")
        self.assertEqual(
            result,
            {
                "category": "technology",
                "slug": "energy-efficiency",
            },
        )

    def test_all_patterns_have_metadata(self):
        """Test that all patterns have required metadata"""
        patterns = path_pattern_registry.list_patterns()

        for pattern in patterns:
            # Check required attributes
            self.assertIsNotNone(pattern.key, f"Pattern missing key")
            self.assertIsNotNone(pattern.name, f"Pattern {pattern.key} missing name")
            self.assertIsNotNone(
                pattern.regex_pattern, f"Pattern {pattern.key} missing regex"
            )
            self.assertTrue(
                pattern.example_url, f"Pattern {pattern.key} missing example_url"
            )
            self.assertTrue(
                pattern.extracted_variables,
                f"Pattern {pattern.key} missing extracted_variables",
            )

            # Check that example URL matches the pattern
            result = pattern.validate_match(pattern.example_url)
            self.assertIsNotNone(
                result,
                f"Pattern {pattern.key}: example_url '{pattern.example_url}' doesn't match its own regex",
            )

            # Check extracted_variables structure
            for var in pattern.extracted_variables:
                self.assertIn(
                    "name", var, f"Pattern {pattern.key}: variable missing 'name'"
                )
                self.assertIn(
                    "type", var, f"Pattern {pattern.key}: variable missing 'type'"
                )
                self.assertIn(
                    "description",
                    var,
                    f"Pattern {pattern.key}: variable missing 'description'",
                )
                self.assertIn(
                    "example", var, f"Pattern {pattern.key}: variable missing 'example'"
                )

    def test_patterns_use_named_groups(self):
        """Test that all patterns use named capture groups"""
        patterns = path_pattern_registry.list_patterns()

        for pattern in patterns:
            # If pattern has capture groups, they should be named
            if "(" in pattern.regex_pattern:
                self.assertIn(
                    "?P<",
                    pattern.regex_pattern,
                    f"Pattern {pattern.key} has unnamed capture groups",
                )
