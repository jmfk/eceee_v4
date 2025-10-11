"""
Tests for the Path Pattern Registry System

Tests registration, pattern matching, and security features of the path pattern registry.
"""

from django.test import TestCase
from django.core.exceptions import ImproperlyConfigured

from ..path_pattern_registry import (
    BasePathPattern,
    PathPatternRegistry,
    register_path_pattern,
    path_pattern_registry,
)


class TestPathPattern(BasePathPattern):
    """Test pattern for use in tests"""

    key = "test_pattern"
    name = "Test Pattern"
    description = "A test pattern"
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "test-slug/"
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "Test slug",
            "example": "test-slug",
        }
    ]


class PathPatternRegistryTests(TestCase):
    """Test cases for the PathPatternRegistry class"""

    def setUp(self):
        """Set up test fixtures"""
        self.registry = PathPatternRegistry()

    def tearDown(self):
        """Clean up after tests"""
        self.registry.clear()

    def test_register_pattern(self):
        """Test registering a path pattern"""
        self.registry.register(TestPathPattern)

        self.assertTrue(self.registry.is_registered("test_pattern"))
        pattern = self.registry.get_pattern("test_pattern")
        self.assertIsNotNone(pattern)
        self.assertEqual(pattern.key, "test_pattern")

    def test_register_invalid_pattern(self):
        """Test that registering an invalid pattern raises an error"""

        # Pattern without BasePathPattern inheritance
        class InvalidPattern:
            pass

        with self.assertRaises(ImproperlyConfigured):
            self.registry.register(InvalidPattern)

    def test_register_pattern_without_key(self):
        """Test that registering a pattern without a key raises an error"""

        class PatternWithoutKey(BasePathPattern):
            key = None
            name = "Test"
            regex_pattern = r"^test/$"

        with self.assertRaises(ImproperlyConfigured):
            self.registry.register(PatternWithoutKey)

    def test_register_pattern_without_name(self):
        """Test that registering a pattern without a name raises an error"""

        class PatternWithoutName(BasePathPattern):
            key = "test"
            name = None
            regex_pattern = r"^test/$"

        with self.assertRaises(ImproperlyConfigured):
            self.registry.register(PatternWithoutName)

    def test_register_pattern_with_invalid_regex(self):
        """Test that registering a pattern with invalid regex raises an error"""

        class PatternWithInvalidRegex(BasePathPattern):
            key = "test"
            name = "Test"
            regex_pattern = r"^(?P<invalid"  # Invalid regex

        with self.assertRaises(ImproperlyConfigured):
            self.registry.register(PatternWithInvalidRegex)

    def test_unregister_pattern(self):
        """Test unregistering a path pattern"""
        self.registry.register(TestPathPattern)
        self.assertTrue(self.registry.is_registered("test_pattern"))

        self.registry.unregister("test_pattern")
        self.assertFalse(self.registry.is_registered("test_pattern"))
        self.assertIsNone(self.registry.get_pattern("test_pattern"))

    def test_list_patterns(self):
        """Test listing all registered patterns"""
        self.registry.register(TestPathPattern)

        patterns = self.registry.list_patterns()
        self.assertEqual(len(patterns), 1)
        self.assertEqual(patterns[0].key, "test_pattern")

    def test_list_pattern_keys(self):
        """Test listing all pattern keys"""
        self.registry.register(TestPathPattern)

        keys = self.registry.list_pattern_keys()
        self.assertEqual(keys, ["test_pattern"])

    def test_to_dict(self):
        """Test serializing all patterns to dict"""
        self.registry.register(TestPathPattern)

        data = self.registry.to_dict()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["key"], "test_pattern")
        self.assertEqual(data[0]["name"], "Test Pattern")

    def test_validate_path(self):
        """Test validating a path against a pattern"""
        self.registry.register(TestPathPattern)

        result = self.registry.validate_path("test_pattern", "my-article/")
        self.assertIsNotNone(result)
        self.assertEqual(result, {"slug": "my-article"})

    def test_validate_path_no_match(self):
        """Test validating a path that doesn't match"""
        self.registry.register(TestPathPattern)

        result = self.registry.validate_path("test_pattern", "invalid path!")
        self.assertIsNone(result)

    def test_validate_path_nonexistent_pattern(self):
        """Test validating against a nonexistent pattern"""
        result = self.registry.validate_path("nonexistent", "test/")
        self.assertIsNone(result)


class BasePathPatternTests(TestCase):
    """Test cases for the BasePathPattern class"""

    def test_pattern_initialization(self):
        """Test that a pattern initializes correctly"""
        pattern = TestPathPattern()

        self.assertEqual(pattern.key, "test_pattern")
        self.assertEqual(pattern.name, "Test Pattern")
        self.assertIsNotNone(pattern._compiled_pattern)

    def test_validate_match_success(self):
        """Test successful pattern matching"""
        pattern = TestPathPattern()

        result = pattern.validate_match("test-slug/")
        self.assertEqual(result, {"slug": "test-slug"})

    def test_validate_match_failure(self):
        """Test failed pattern matching"""
        pattern = TestPathPattern()

        result = pattern.validate_match("invalid!")
        self.assertIsNone(result)

    def test_to_dict(self):
        """Test pattern serialization"""
        pattern = TestPathPattern()

        data = pattern.to_dict()
        self.assertEqual(data["key"], "test_pattern")
        self.assertEqual(data["name"], "Test Pattern")
        self.assertEqual(data["description"], "A test pattern")
        self.assertEqual(data["regex_pattern"], r"^(?P<slug>[\w-]+)/$")
        self.assertEqual(data["example_url"], "test-slug/")
        self.assertEqual(len(data["extracted_variables"]), 1)

    def test_str_representation(self):
        """Test string representation"""
        pattern = TestPathPattern()
        self.assertEqual(str(pattern), "Test Pattern (test_pattern)")

    def test_repr_representation(self):
        """Test repr representation"""
        pattern = TestPathPattern()
        self.assertIn("TestPathPattern", repr(pattern))
        self.assertIn("test_pattern", repr(pattern))


class PathPatternDecoratorTests(TestCase):
    """Test cases for the @register_path_pattern decorator"""

    def setUp(self):
        """Clean registry before each test"""
        path_pattern_registry.clear()

    def tearDown(self):
        """Clean registry after each test"""
        path_pattern_registry.clear()

    def test_decorator_registers_pattern(self):
        """Test that the decorator registers a pattern"""

        @register_path_pattern
        class DecoratedPattern(BasePathPattern):
            key = "decorated"
            name = "Decorated Pattern"
            regex_pattern = r"^test/$"

        self.assertTrue(path_pattern_registry.is_registered("decorated"))

    def test_decorator_returns_class(self):
        """Test that the decorator returns the class"""

        @register_path_pattern
        class DecoratedPattern(BasePathPattern):
            key = "decorated"
            name = "Decorated Pattern"
            regex_pattern = r"^test/$"

        # Should be able to instantiate the class
        instance = DecoratedPattern()
        self.assertEqual(instance.key, "decorated")
