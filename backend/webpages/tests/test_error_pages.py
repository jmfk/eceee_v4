"""
Tests for Custom Error Pages Feature

Tests error page creation, validation, rendering, and fallback behavior.
"""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from easy_widgets.widgets.navigation import NavigationWidget
from webpages.layout_registry import layout_registry
from webpages.models import PageTheme, PageVersion, WebPage
from webpages.public_views import HostnamePageView, custom_404_handler, page_search_view, page_sitemap_view
from webpages.serializers import WebPageListSerializer
from webpages.theme_layouts import default_theme_layouts
from webpages.views.webpage_views import WebPageViewSet

User = get_user_model()


class ErrorPageValidationTests(TestCase):
    """Test validation rules for error pages"""

    def setUp(self):
        from django.db import connection

        if connection.vendor == "sqlite":
            return
        from core.models import Tenant

        self.user = User.objects.create_user(
            username="testuser_error", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-error", created_by=self.user)

        # Create a root page
        from django.db import connection

        if connection.vendor == "sqlite":
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                tenant=self.tenant,
            )
        else:
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                hostnames=["testsite.com"],
                tenant=self.tenant,
            )

    def test_error_page_slug_validation_valid_codes(self):
        """Test that valid HTTP error codes (400-599) are accepted"""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
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
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
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
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        # Create a child page
        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Try to create error page under child page
        error_page = WebPage(
            title="Error 404",
            slug="404",
            parent=child_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        with self.assertRaises(ValidationError) as context:
            error_page.clean()

        self.assertIn("must be direct children of root pages", str(context.exception))

    def test_error_page_uniqueness_per_site(self):
        """Test that only one error page per code can exist per site"""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        # Create first 404 page
        WebPage.objects.create(
            title="Error 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Try to create another 404 page under same root
        error_page_2 = WebPage(
            title="Another Error 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        with self.assertRaises(ValidationError) as context:
            error_page_2.clean()

        self.assertIn("already exists for this site", str(context.exception))

    def test_non_error_code_slugs_allowed(self):
        """Test that non-error code slugs work normally"""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
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
        from django.db import connection

        if connection.vendor == "sqlite":
            return
        from core.models import Tenant

        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="testuser_error_render", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant Render", identifier="test-error-render", created_by=self.user
        )

        # Create a root page
        from django.db import connection

        if connection.vendor == "sqlite":
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                tenant=self.tenant,
            )
        else:
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                hostnames=["testsite.com"],
                tenant=self.tenant,
            )
        self.theme = PageTheme.objects.create(
            name="Error theme",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
            layouts=default_theme_layouts(),
        )

    def test_custom_404_page_found(self):
        """The standard 404 definition comes from the active theme."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        view = HostnamePageView()
        found_page = view._get_error_page(self.root_page, 404)

        self.assertIsNotNone(found_page)
        self.assertEqual(found_page["key"], "error_404")
        self.assertEqual(found_page["theme"], self.theme)

    def test_theme_error_pages_render_without_page_or_version_rows(self):
        special_page = next(page for page in self.theme.layouts["special_pages"] if page["status_code"] == 404)
        self.assertEqual(special_page["layout_key"], "error_layout")
        self.assertEqual(special_page["widgets"]["visual"][0]["type"], "easy_widgets.ImageWidget")
        self.assertEqual(special_page["widgets"]["message"][0]["type"], "easy_widgets.HeadlineWidget")
        self.assertFalse(WebPage.objects.filter(parent=self.root_page, slug="404").exists())

        view = HostnamePageView()
        view.request = self.factory.get("/missing/", HTTP_HOST="testsite.com")
        response = view._render_error_page(self.root_page, 404)
        self.assertContains(response, "404 — Page not found", status_code=404)
        self.assertContains(response, "Return to the home page", status_code=404)

    def test_special_route_is_not_exposed_when_site_root_is_unpublished(self):
        layouts = self.theme.layouts
        layouts["special_pages"].append(
            {
                "id": "3f288deb-5487-47c4-84da-3d69a65b7384",
                "key": "login",
                "label": "Log in",
                "kind": "route",
                "route": "login",
                "layout_key": "main_layout",
                "widgets": {},
            }
        )
        self.theme.layouts = layouts
        self.theme.save(update_fields=["layouts"])
        request = self.factory.get("/login/", HTTP_HOST="testsite.com")
        view = HostnamePageView()
        view.request = request
        view.kwargs = {"slug_path": "login"}

        with patch.object(WebPage, "get_root_page_for_hostname", return_value=self.root_page):
            response = view.get(request, slug_path="login")

        self.assertEqual(response.status_code, 404)

    def test_custom_404_page_not_found_returns_none(self):
        """A site without an effective theme has no special error page."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        view = HostnamePageView()
        root = type("Root", (), {"get_effective_theme": lambda _self: None})()
        found_page = view._get_error_page(root, 404)

        self.assertIsNone(found_page)

    def test_unpublished_error_page_not_used(self):
        """A legacy unpublished Page row cannot override the theme error page."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        # Create custom 404 page but don't publish it
        WebPage.objects.create(
            title="Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        view = HostnamePageView()
        found_page = view._get_error_page(self.root_page, 404)

        self.assertEqual(found_page["key"], "error_404")

    def test_custom_404_handler_with_valid_hostname(self):
        """The custom handler renders the theme-owned 404 page."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        # Create request
        request = self.factory.get("/nonexistent-page/", HTTP_HOST="testsite.com")

        # Call custom 404 handler
        response = custom_404_handler(request)

        # Should return custom error page with 404 status
        self.assertEqual(response.status_code, 404)

    def test_custom_404_handler_invalid_hostname_uses_default(self):
        """Test that invalid hostnames fall back to default 404"""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        request = self.factory.get("/nonexistent/", HTTP_HOST="../invalid")

        response = custom_404_handler(request)

        # Should return default 404
        self.assertEqual(response.status_code, 404)


class ErrorLayoutTests(SimpleTestCase):
    """Test error layout registration and availability"""

    def setUp(self):
        from webpages.layout_autodiscovery import autodiscover_layouts

        autodiscover_layouts()

    def test_error_layouts_registered(self):
        """Test that error layouts are registered in the layout registry"""
        # Check that error layouts exist
        error_layout_names = ["error_layout", "error_404", "error_500", "error_403", "error_503"]

        for layout_name in error_layout_names:
            layout = layout_registry.get_layout(layout_name)
            self.assertIsNotNone(layout, f"Layout {layout_name} should be registered")

    def test_shared_error_layout_has_canonical_theme_slots(self):
        """The shared conversion source matches the required Theme Layout contract."""
        layout = layout_registry.get_layout("error_layout")
        self.assertIsNotNone(layout)

        slots = layout.slot_configuration.get("slots", [])
        slot_names = [slot["name"] for slot in slots]

        self.assertEqual(slot_names, ["visual", "message", "actions"])

    def test_legacy_status_error_layouts_keep_their_template_slots(self):
        """Django compatibility templates retain their original slot contract."""
        layout = layout_registry.get_layout("error_404")
        slot_names = [slot["name"] for slot in layout.slot_configuration.get("slots", [])]

        self.assertEqual(slot_names, ["branding", "error_message", "helpful_content"])

    def test_error_layout_template_names(self):
        """Test that error layouts have correct template names"""
        expected_templates = {
            "error_layout": "webpages/page_detail.html",
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
        from django.db import connection

        if connection.vendor == "sqlite":
            return
        from core.models import Tenant

        self.factory = RequestFactory()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser_error_int", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(name="Test Tenant Int", identifier="test-error-int", created_by=self.user)

        # Create a root page
        from django.db import connection

        if connection.vendor == "sqlite":
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                tenant=self.tenant,
            )
        else:
            self.root_page = WebPage.objects.create(
                title="Test Site",
                slug="home",
                created_by=self.user,
                last_modified_by=self.user,
                hostnames=["testsite.com"],
                tenant=self.tenant,
            )
        self.theme = PageTheme.objects.create(
            name="Integration error theme",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
            layouts=default_theme_layouts(),
        )
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_pages_api_rejects_new_legacy_error_page_rows(self):
        response = self.client.post(
            reverse("api:webpage-list"),
            {"title": "Legacy 404", "slug": "404", "parentId": self.root_page.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Layout Editor", str(response.data["slug"]))
        self.assertFalse(WebPage.objects.filter(parent=self.root_page, slug="404").exists())

    def test_legacy_site_specific_error_pages_do_not_override_theme(self):
        """Dormant legacy error rows remain recoverable but are not runtime content."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        legacy_page = WebPage.objects.create(
            title="Site 1 Not Found",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        view = HostnamePageView()
        found = view._get_error_page(self.root_page, 404)

        self.assertNotEqual(found.get("id"), legacy_page.id)
        self.assertEqual(found["key"], "error_404")

    def test_legacy_error_rows_are_hidden_from_pages_queries_and_counts(self):
        legacy_page = WebPage.objects.create(
            title="Legacy 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        ordinary_page = WebPage.objects.create(
            title="About",
            slug="about",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        legacy_child = WebPage.objects.create(
            title="Hidden help",
            slug="help",
            parent=legacy_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        view = WebPageViewSet()
        view.action = "list"
        view.request = type("Request", (), {"tenant": self.tenant, "user": self.user})()

        ids = set(view.get_queryset().values_list("id", flat=True))
        serialized_root = WebPageListSerializer(self.root_page).data

        self.assertNotIn(legacy_page.id, ids)
        self.assertNotIn(legacy_child.id, ids)
        self.assertIn(ordinary_page.id, ids)
        self.assertEqual(serialized_root["children_count"], 1)

    def test_legacy_error_rows_are_hidden_from_public_sitemap_and_navigation(self):
        legacy_page = WebPage.objects.create(
            title="Legacy 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        ordinary_page = WebPage.objects.create(
            title="About",
            slug="about",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        legacy_child = WebPage.objects.create(
            title="Hidden legacy help",
            slug="help",
            parent=legacy_page,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        for page in (legacy_page, legacy_child, ordinary_page):
            PageVersion.objects.create(
                page=page,
                version_number=1,
                version_title="Published",
                effective_date=timezone.now(),
                created_by=self.user,
            )

        request = self.factory.get("/sitemap.xml", HTTP_HOST="testsite.com")
        sitemap = page_sitemap_view(request).content.decode()
        search_request = self.factory.get("/search/", {"q": "Hidden"}, HTTP_HOST="testsite.com")
        search_results = json.loads(page_search_view(search_request).content)["results"]
        navigation = NavigationWidget()._get_page_hierarchy_context(
            {
                "webpage_data": {
                    "id": self.root_page.id,
                    "title": self.root_page.title,
                    "slug": self.root_page.slug,
                    "cached_path": "/",
                }
            }
        )

        self.assertNotIn("/404/", sitemap)
        self.assertNotIn("/404/help/", sitemap)
        self.assertEqual(search_results, [])
        self.assertIn("/about/", sitemap)
        self.assertEqual([item["id"] for item in navigation["currentChildren"]], [ordinary_page.id])

        explicit_items = NavigationWidget()._process_menu_items(
            [
                {
                    "link_data": {
                        "type": "internal",
                        "page_id": legacy_child.id,
                        "label": "Hidden help",
                    }
                }
            ],
            {},
        )
        self.assertEqual(explicit_items, [])
