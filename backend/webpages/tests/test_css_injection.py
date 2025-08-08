"""
Tests for the dynamic CSS injection system

Tests cover:
- CSS validation and security
- CSS scoping and injection
- Widget-specific CSS handling
- Page-specific CSS capabilities
- Performance and caching
"""

from django.test import TestCase
from django.contrib.auth.models import User
from unittest.mock import patch, MagicMock

from webpages.models import WebPage, PageTheme
from webpages.css_validation import CSSValidator, CSSInjectionManager, CSSSecurityError
from webpages.widget_registry import WidgetTypeRegistry


class CSSValidatorTestCase(TestCase):
    """Test CSS validation and security"""

    def setUp(self):
        self.validator = CSSValidator()

    def test_valid_css_passes_validation(self):
        """Test that valid CSS passes validation"""
        css = """
        .test-class {
            color: blue;
            font-size: 16px;
            margin: 10px;
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_dangerous_javascript_url_detected(self):
        """Test that JavaScript URLs are detected and blocked"""
        css = """
        .test {
            background: url(javascript:alert('xss'));
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertFalse(is_valid)
        self.assertIn("Security risk detected", str(errors))

    def test_expression_function_blocked(self):
        """Test that IE expression() function is blocked"""
        css = """
        .test {
            width: expression(document.body.clientWidth);
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertFalse(is_valid)
        self.assertIn("Security risk detected", str(errors))

    def test_unbalanced_braces_detected(self):
        """Test that unbalanced braces are detected"""
        css = """
        .test {
            color: blue;
        .test2 {
            color: red;
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertFalse(is_valid)
        self.assertIn("Unbalanced braces", str(errors))

    def test_css_size_limit_enforced(self):
        """Test that CSS size limits are enforced"""
        # Create CSS larger than 100KB
        large_css = ".test { color: blue; }" * 10000

        is_valid, errors, warnings = self.validator.validate_css(large_css)
        self.assertFalse(is_valid)
        self.assertIn("exceeds maximum size limit", str(errors))

    def test_css_sanitization(self):
        """Test CSS sanitization removes dangerous content"""
        css = """
        .test {
            color: blue;
            background: url(javascript:alert('xss'));
        }
        """

        sanitized = self.validator.sanitize_css(css)
        self.assertNotIn("javascript:", sanitized)
        self.assertIn("color: blue", sanitized)

    def test_valid_data_urls_allowed(self):
        """Test that valid data URLs for images are allowed"""
        css = """
        .test {
            background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==);
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertTrue(is_valid)

    def test_https_urls_allowed(self):
        """Test that HTTPS URLs are allowed"""
        css = """
        .test {
            background: url(https://example.com/image.png);
        }
        """

        is_valid, errors, warnings = self.validator.validate_css(css)
        self.assertTrue(is_valid)


class CSSInjectionManagerTestCase(TestCase):
    """Test CSS injection manager functionality"""

    def setUp(self):
        self.manager = CSSInjectionManager()

    def test_scope_id_generation(self):
        """Test CSS scope ID generation"""
        scope_id = self.manager.generate_css_scope_id(
            widget_id="123", page_id="456", slot_name="header"
        )

        self.assertIn("page-456", scope_id)
        self.assertIn("slot-header", scope_id)
        self.assertIn("widget-123", scope_id)

    def test_css_scoping_applies_correctly(self):
        """Test that CSS scoping is applied correctly"""
        css = """
        .widget {
            color: blue;
        }
        
        .content {
            font-size: 16px;
        }
        """

        scoped_css = self.manager.scope_css(css, "test-scope", "widget")

        self.assertIn(".test-scope .widget", scoped_css)
        self.assertIn(".test-scope .content", scoped_css)
        self.assertIn("color: blue", scoped_css)
        self.assertIn("font-size: 16px", scoped_css)

    def test_global_scope_bypasses_scoping(self):
        """Test that global scope bypasses CSS scoping"""
        css = ".widget { color: blue; }"

        scoped_css = self.manager.scope_css(css, "test-scope", "global")

        self.assertEqual(css, scoped_css)
        self.assertNotIn(".test-scope", scoped_css)

    def test_css_validation_and_injection(self):
        """Test CSS validation and injection process"""
        css = ".test { color: blue; }"

        is_valid, processed_css, errors = self.manager.validate_and_inject_css(
            css, scope_id="test-scope", scope_type="widget", context="Test Widget"
        )

        self.assertTrue(is_valid)
        self.assertIn(".test-scope .test", processed_css)
        self.assertEqual(len(errors), 0)

    def test_invalid_css_rejected(self):
        """Test that invalid CSS is properly rejected"""
        css = ".test { background: url(javascript:alert('xss')); }"

        is_valid, processed_css, errors = self.manager.validate_and_inject_css(
            css, context="Test Widget"
        )

        self.assertFalse(is_valid)
        self.assertEqual(processed_css, "")
        self.assertGreater(len(errors), 0)

    def test_cache_key_generation(self):
        """Test cache key generation"""
        key1 = self.manager._generate_cache_key("css1", "scope1", "widget")
        key2 = self.manager._generate_cache_key("css1", "scope1", "widget")
        key3 = self.manager._generate_cache_key("css2", "scope1", "widget")

        self.assertEqual(key1, key2)  # Same input should generate same key
        self.assertNotEqual(key1, key3)  # Different input should generate different key


class WebPageCSSTestCase(TestCase):
    """Test WebPage CSS functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass"
        )

        self.theme = PageTheme.objects.create(
            name="Test Theme",
            description="Test theme for CSS testing",
            css_variables={"primary": "#3b82f6", "secondary": "#64748b"},
            custom_css=".test-theme { color: var(--primary); }",
            created_by=self.user,
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            theme=self.theme,
            page_css_variables={
                "primary": "#ef4444",  # Override theme primary
                "page-specific": "#10b981",
            },
            page_custom_css=".page-custom { background: var(--page-specific); }",
            enable_css_injection=True,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_effective_css_data_compilation(self):
        """Test that effective CSS data is compiled correctly"""
        css_data = self.page.get_effective_css_data()

        # Check that all CSS sources are included
        self.assertIn("theme_css_variables", css_data)
        self.assertIn("page_css_variables", css_data)
        self.assertIn("merged_css_variables", css_data)
        self.assertIn("theme_custom_css", css_data)
        self.assertIn("page_custom_css", css_data)

        # Check theme CSS variables
        self.assertEqual(css_data["theme_css_variables"]["primary"], "#3b82f6")
        self.assertEqual(css_data["theme_css_variables"]["secondary"], "#64748b")

        # Check page CSS variables
        self.assertEqual(css_data["page_css_variables"]["primary"], "#ef4444")
        self.assertEqual(css_data["page_css_variables"]["page-specific"], "#10b981")

        # Check merged variables (page should override theme)
        self.assertEqual(css_data["merged_css_variables"]["primary"], "#ef4444")
        self.assertEqual(css_data["merged_css_variables"]["secondary"], "#64748b")
        self.assertEqual(css_data["merged_css_variables"]["page-specific"], "#10b981")

        # Check custom CSS
        self.assertEqual(
            css_data["theme_custom_css"], ".test-theme { color: var(--primary); }"
        )
        self.assertEqual(
            css_data["page_custom_css"],
            ".page-custom { background: var(--page-specific); }",
        )

    def test_css_validation_status(self):
        """Test CSS validation for pages"""
        is_valid, errors, warnings = self.page.validate_page_css()

        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_invalid_css_detected(self):
        """Test that invalid CSS is detected in page validation"""
        # Create page with invalid CSS
        invalid_page = WebPage.objects.create(
            title="Invalid Page",
            slug="invalid-page",
            page_custom_css='.test { background: url(javascript:alert("xss")); }',
            enable_css_injection=True,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        is_valid, errors, warnings = invalid_page.validate_page_css()

        self.assertFalse(is_valid)
        self.assertGreater(len(errors), 0)

    def test_complete_css_generation(self):
        """Test complete CSS generation for a page"""
        complete_css = self.page.generate_complete_css(include_scoping=False)

        # Should include CSS variables
        self.assertIn(":root {", complete_css)
        self.assertIn("--primary: #ef4444;", complete_css)
        self.assertIn("--secondary: #64748b;", complete_css)
        self.assertIn("--page-specific: #10b981;", complete_css)

        # Should include theme CSS
        self.assertIn("/* Theme CSS */", complete_css)
        self.assertIn(".test-theme { color: var(--primary); }", complete_css)

        # Should include page CSS
        self.assertIn("/* Page CSS */", complete_css)
        self.assertIn(
            ".page-custom { background: var(--page-specific); }", complete_css
        )

    def test_css_generation_with_scoping(self):
        """Test CSS generation with scoping enabled"""
        complete_css = self.page.generate_complete_css(include_scoping=True)

        # CSS variables should remain unscoped
        self.assertIn(":root {", complete_css)

        # Page CSS should be scoped
        self.assertIn("/* Page CSS */", complete_css)
        # Should contain scoped selector (exact format depends on implementation)
        self.assertIn("css-page-", complete_css)

    def test_css_inheritance_from_theme(self):
        """Test CSS inheritance from theme"""
        # Create child page without theme
        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child-page",
            parent=self.page,  # Inherit from parent
            enable_css_injection=True,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        css_data = child_page.get_effective_css_data()

        # Should inherit theme from parent
        self.assertEqual(css_data["theme_css_variables"]["primary"], "#3b82f6")
        self.assertEqual(
            css_data["theme_custom_css"], ".test-theme { color: var(--primary); }"
        )


class WidgetCSSTestCase(TestCase):
    """Test widget CSS functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass"
        )

    def test_widget_css_injection_data(self):
        """Test that widgets provide CSS injection data"""
        # Get a widget type that supports CSS
        registry = WidgetTypeRegistry()
        text_widget = registry.get_widget_type("Text Block")

        self.assertIsNotNone(text_widget)

        # Test CSS injection data
        css_data = text_widget.get_css_for_injection()

        self.assertIn("widget_css", css_data)
        self.assertIn("css_variables", css_data)
        self.assertIn("scope", css_data)
        self.assertIn("enable_injection", css_data)

        # Check that CSS content is provided
        self.assertIsNotNone(css_data["widget_css"])
        self.assertIn(".text-block-widget", css_data["widget_css"])

        # Check CSS variables
        self.assertIn("text-font", css_data["css_variables"])
        self.assertIn("text-line-height", css_data["css_variables"])

    def test_widget_css_validation(self):
        """Test widget CSS validation"""
        registry = WidgetTypeRegistry()
        text_widget = registry.get_widget_type("Text Block")

        is_valid, errors = text_widget.validate_css_content()

        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_button_widget_css_features(self):
        """Test button widget CSS features"""
        registry = WidgetTypeRegistry()
        button_widget = registry.get_widget_type("Button")

        self.assertIsNotNone(button_widget)

        css_data = button_widget.get_css_for_injection()

        # Should have comprehensive button styling
        self.assertIn(".button-widget", css_data["widget_css"])
        self.assertIn("style-primary", css_data["widget_css"])
        self.assertIn("style-secondary", css_data["widget_css"])
        self.assertIn("size-small", css_data["widget_css"])
        self.assertIn("hover", css_data["widget_css"])

        # Should have button-specific CSS variables
        self.assertIn("button-primary-bg", css_data["css_variables"])
        self.assertIn("button-primary-hover", css_data["css_variables"])


class CSSPerformanceTestCase(TestCase):
    """Test CSS injection performance and caching"""

    def setUp(self):
        self.manager = CSSInjectionManager()

    def test_css_caching_works(self):
        """Test that CSS caching improves performance"""
        css = ".test { color: blue; }"

        # First injection should process and cache
        with patch.object(self.manager, "scope_css") as mock_scope:
            mock_scope.return_value = ".scoped .test { color: blue; }"

            is_valid1, processed1, errors1 = self.manager.validate_and_inject_css(
                css, "test-scope", "widget", "Test"
            )

            # Should call scope_css once
            self.assertEqual(mock_scope.call_count, 1)

        # Second injection with same parameters should use cache
        with patch.object(self.manager, "scope_css") as mock_scope:
            mock_scope.return_value = ".scoped .test { color: blue; }"

            is_valid2, processed2, errors2 = self.manager.validate_and_inject_css(
                css, "test-scope", "widget", "Test"
            )

            # Should not call scope_css (using cache)
            self.assertEqual(mock_scope.call_count, 0)

            # Results should be identical
            self.assertEqual(processed1, processed2)

    def test_cache_clear_functionality(self):
        """Test cache clearing functionality"""
        self.manager.cssCache = {"test": "value"}

        self.manager.clear_cache()

        self.assertEqual(len(self.manager._css_cache), 0)


class CSSIntegrationTestCase(TestCase):
    """Integration tests for the complete CSS injection system"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass"
        )

        self.theme = PageTheme.objects.create(
            name="Integration Theme",
            css_variables={"primary": "#3b82f6"},
            custom_css=".integration-theme { color: var(--primary); }",
            created_by=self.user,
        )

        self.page = WebPage.objects.create(
            title="Integration Page",
            slug="integration-page",
            created_by=self.user,
            last_modified_by=self.user,
        )
        # Create a published version carrying theme and CSS data (new model)
        from django.utils import timezone

        version = self.page.create_version(self.user, "Initial")
        version.theme = self.theme
        version.page_css_variables = {"accent": "#10b981"}
        version.page_custom_css = ".integration-page { background: var(--accent); }"
        version.enable_css_injection = True
        version.effective_date = timezone.now()
        version.save()

    def test_complete_css_system_integration(self):
        """Test the complete CSS system working together"""
        # Test CSS data compilation
        css_data = self.page.get_effective_css_data()

        self.assertTrue(css_data["enable_css_injection"])
        self.assertIn("primary", css_data["theme_css_variables"])
        self.assertIn("accent", css_data["page_css_variables"])

        # Test CSS validation
        is_valid, errors, warnings = self.page.validate_page_css()
        self.assertTrue(is_valid)

        # Test complete CSS generation
        complete_css = self.page.generate_complete_css()

        self.assertIn("--primary: #3b82f6", complete_css)
        self.assertIn("--accent: #10b981", complete_css)
        self.assertIn(".integration-theme", complete_css)
        self.assertIn(".integration-page", complete_css)

    def test_css_system_with_disabled_injection(self):
        """Test CSS system behavior when injection is disabled"""
        self.page.enable_css_injection = False
        self.page.save()

        css_data = self.page.get_effective_css_data()

        self.assertFalse(css_data["enable_css_injection"])

        # CSS data should still be available for manual use
        self.assertIn("theme_css_variables", css_data)
        self.assertIn("page_css_variables", css_data)
