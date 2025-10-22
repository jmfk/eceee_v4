"""
Tests for Custom Error Pages Feature

Tests error page creation, validation, rendering, and fallback behavior.
"""

from django.test import TestCase, RequestFactory, override_settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.http import Http404
from webpages.models import WebPage
from webpages.public_views import HostnamePageView, custom_404_handler
from webpages.layout_registry import layout_registry

User = get_user_model()


class ErrorPageValidationTests(TestCase):
    """Test validation rules for error pages"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create a root page
        self.root_page = WebPage.objects.create(
            title="Test Site",
            slug="home",
            created_by=self.user,
            last_modified_by=self.user,
            hostnames=["testsite.com"],
        )

    def test_error_page_slug_validation_valid_codes(self):
        """Test that valid HTTP error codes (400-599) are accepted"""
        valid_codes = ["400", "404", "500", "503"]

        for code in valid_codes:
            page = WebPage(
                title=f"Error {code}",
                slug=code,
                parent=self.root_page,
                created_by=self.user,
                last_modified_by=self.user,
            )
            # Should not raise ValidationError
            page.clean()

    def test_error_page_must_be_under_root(self):
        """Test that error pages must be direct children of root pages"""
        # Try to create error page at root level
        error_page = WebPage(
            title="Error 404",
            slug="404",
            parent=None,
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            error_page.clean()

        self.assertIn("must be under a root page", str(context.exception))

    def test_error_page_must_be_direct_child_of_root(self):
        """Test that error pages cannot be nested deeper than one level"""
        # Create a child page
        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create error page under child page
        error_page = WebPage(
            title="Error 404",
            slug="404",
            parent=child_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            error_page.clean()

        self.assertIn("must be direct children of root pages", str(context.exception))

    def test_error_page_uniqueness_per_site(self):
        """Test that only one error page per code can exist per site"""
        # Create first 404 page
        error_page_1 = WebPage.objects.create(
            title="Error 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create another 404 page under same root
        error_page_2 = WebPage(
            title="Another Error 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            error_page_2.clean()

        self.assertIn("already exists for this site", str(context.exception))

    def test_non_error_code_slugs_allowed(self):
        """Test that non-error code slugs work normally"""
        # Slugs that are not error codes
        normal_slugs = ["about", "contact", "123", "599", "600", "399"]

        for slug in normal_slugs:
            page = WebPage(
                title=f"Page {slug}",
                slug=slug,
                parent=self.root_page,
                created_by=self.user,
                last_modified_by=self.user,
            )
            # Should not raise ValidationError for error page rules
            page.clean()


class ErrorPageRenderingTests(TestCase):
    """Test error page rendering and fallback behavior"""

    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create a root page
        self.root_page = WebPage.objects.create(
            title="Test Site",
            slug="home",
            created_by=self.user,
            last_modified_by=self.user,
            hostnames=["testsite.com"],
        )

    def test_custom_404_page_found(self):
        """Test that custom 404 page is found for a site"""
        # Create custom 404 page
        error_404 = WebPage.objects.create(
            title="Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Publish the error page
        from webpages.models import PageVersion

        version = PageVersion.objects.create(
            page=error_404,
            version_number=1,
            title="Not Found",
            created_by=self.user,
            widgets={},
            page_data={},
            code_layout="error_404",
        )
        version.publish(self.user)

        # Test the _get_error_page method
        view = HostnamePageView()
        found_page = view._get_error_page(self.root_page, 404)

        self.assertIsNotNone(found_page)
        self.assertEqual(found_page.id, error_404.id)

    def test_custom_404_page_not_found_returns_none(self):
        """Test that None is returned when no custom 404 page exists"""
        view = HostnamePageView()
        found_page = view._get_error_page(self.root_page, 404)

        self.assertIsNone(found_page)

    def test_unpublished_error_page_not_used(self):
        """Test that unpublished error pages are not used"""
        # Create custom 404 page but don't publish it
        error_404 = WebPage.objects.create(
            title="Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        view = HostnamePageView()
        found_page = view._get_error_page(self.root_page, 404)

        self.assertIsNone(found_page)

    def test_custom_404_handler_with_valid_hostname(self):
        """Test custom 404 handler finds error page for valid hostname"""
        # Create and publish custom 404 page
        error_404 = WebPage.objects.create(
            title="Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        from webpages.models import PageVersion

        version = PageVersion.objects.create(
            page=error_404,
            version_number=1,
            title="Not Found",
            created_by=self.user,
            widgets={},
            page_data={},
            code_layout="error_404",
        )
        version.publish(self.user)

        # Create request
        request = self.factory.get("/nonexistent-page/", HTTP_HOST="testsite.com")

        # Call custom 404 handler
        response = custom_404_handler(request)

        # Should return custom error page with 404 status
        self.assertEqual(response.status_code, 404)

    def test_custom_404_handler_invalid_hostname_uses_default(self):
        """Test that invalid hostnames fall back to default 404"""
        request = self.factory.get("/nonexistent/", HTTP_HOST="../invalid")

        response = custom_404_handler(request)

        # Should return default 404
        self.assertEqual(response.status_code, 404)


class ErrorLayoutTests(TestCase):
    """Test error layout registration and availability"""

    def test_error_layouts_registered(self):
        """Test that error layouts are registered in the layout registry"""
        # Check that error layouts exist
        error_layout_names = ["error_404", "error_500", "error_403", "error_503"]

        for layout_name in error_layout_names:
            layout = layout_registry.get_layout(layout_name)
            self.assertIsNotNone(layout, f"Layout {layout_name} should be registered")

    def test_error_layout_has_required_slots(self):
        """Test that error layouts have the expected slots"""
        layout = layout_registry.get_layout("error_404")
        self.assertIsNotNone(layout)

        slots = layout.slot_configuration.get("slots", [])
        slot_names = [slot["name"] for slot in slots]

        # Error layouts should have these slots
        self.assertIn("branding", slot_names)
        self.assertIn("error_message", slot_names)
        self.assertIn("helpful_content", slot_names)

    def test_error_layout_template_names(self):
        """Test that error layouts have correct template names"""
        expected_templates = {
            "error_404": "default_layouts/layouts/error_404.html",
            "error_500": "default_layouts/layouts/error_500.html",
            "error_403": "default_layouts/layouts/error_403.html",
            "error_503": "default_layouts/layouts/error_503.html",
        }

        for layout_name, expected_template in expected_templates.items():
            layout = layout_registry.get_layout(layout_name)
            self.assertIsNotNone(layout)
            self.assertEqual(layout.template_name, expected_template)


class ErrorPageIntegrationTests(TestCase):
    """Integration tests for error page functionality"""

    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create a root page
        self.root_page = WebPage.objects.create(
            title="Test Site",
            slug="home",
            created_by=self.user,
            last_modified_by=self.user,
            hostnames=["testsite.com"],
        )

    def test_site_specific_error_pages(self):
        """Test that different sites can have different error pages"""
        # Create another root page for a different site
        root_page_2 = WebPage.objects.create(
            title="Another Site",
            slug="home2",
            created_by=self.user,
            last_modified_by=self.user,
            hostnames=["anothersite.com"],
        )

        # Create different 404 pages for each site
        error_404_site1 = WebPage.objects.create(
            title="Site 1 Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        error_404_site2 = WebPage.objects.create(
            title="Site 2 Not Found",
            slug="404",
            parent=root_page_2,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Both should be valid (no ValidationError)
        error_404_site1.clean()
        error_404_site2.clean()

        # Verify they are different pages
        self.assertNotEqual(error_404_site1.id, error_404_site2.id)
        self.assertEqual(error_404_site1.parent, self.root_page)
        self.assertEqual(error_404_site2.parent, root_page_2)
