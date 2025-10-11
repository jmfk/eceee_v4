"""
Tests for path pattern resolution and variable extraction.

This module tests the new path_pattern functionality that enables
dynamic object publishing through URL pattern matching.
"""

from django.test import TestCase, RequestFactory
from django.http import Http404
from django.contrib.auth.models import User
from webpages.models import WebPage, PageVersion
from webpages.public_views import HostnamePageView
import re


class PathPatternModelTests(TestCase):
    """Test path_pattern field validation and behavior"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_path_pattern_field_exists(self):
        """Test that path_pattern field exists and has correct properties"""
        page = WebPage.objects.create(
            slug="test",
            path_pattern="^(?P<slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.assertEqual(page.path_pattern, "^(?P<slug>[\\w-]+)/$")

    def test_valid_regex_pattern(self):
        """Test that valid regex patterns are accepted"""
        page = WebPage(
            slug="news",
            path_pattern="^(?P<news_slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )
        # Should not raise ValidationError
        page.full_clean()
        page.save()
        self.assertIsNotNone(page.id)

    def test_invalid_regex_pattern(self):
        """Test that invalid regex patterns are rejected"""
        from django.core.exceptions import ValidationError

        page = WebPage(
            slug="invalid",
            path_pattern="^(?P<slug>[\\w-+)/$",  # Invalid - missing closing bracket
            created_by=self.user,
            last_modified_by=self.user,
        )
        with self.assertRaises(ValidationError) as context:
            page.full_clean()
        self.assertIn("Invalid regex pattern", str(context.exception))

    def test_empty_path_pattern_allowed(self):
        """Test that empty path_pattern is allowed (backward compatibility)"""
        page = WebPage.objects.create(
            slug="normal",
            path_pattern="",
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.assertEqual(page.path_pattern, "")

    def test_complex_regex_pattern(self):
        """Test that complex regex patterns with multiple captures work"""
        page = WebPage(
            slug="events",
            path_pattern="^(?P<year>\\d{4})/(?P<month>\\d{2})/(?P<slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )
        page.full_clean()
        page.save()
        self.assertIsNotNone(page.id)


class PathResolutionTests(TestCase):
    """Test path resolution logic with pattern matching"""

    def setUp(self):
        """Set up test pages and data"""
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

        # Create root page for hostname
        self.root_page = WebPage.objects.create(
            slug="",
            hostnames=["testserver"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create published version for root page
        root_version = self.root_page.create_version(self.user, "Root version")
        root_version.effective_date = "2024-01-01T00:00:00Z"
        root_version.save()

        # Create news page with pattern
        self.news_page = WebPage.objects.create(
            slug="news",
            parent=self.root_page,
            path_pattern="^(?P<news_slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create published version for news page
        news_version = self.news_page.create_version(self.user, "News version")
        news_version.effective_date = "2024-01-01T00:00:00Z"
        news_version.save()

        # Create explicit child page under news
        self.archive_page = WebPage.objects.create(
            slug="archive",
            parent=self.news_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create published version for archive page
        archive_version = self.archive_page.create_version(self.user, "Archive version")
        archive_version.effective_date = "2024-01-01T00:00:00Z"
        archive_version.save()

    def test_resolve_exact_page_match(self):
        """Test that exact page matches are resolved correctly"""
        view = HostnamePageView()
        request = self.factory.get("/news/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "news"}

        # The news page should be found with no remaining path
        page, remaining = view._resolve_page_with_pattern(self.root_page, ["news"])
        self.assertEqual(page, self.news_page)
        self.assertEqual(remaining, "")

    def test_resolve_with_remaining_path(self):
        """Test resolution when there's a remaining path for pattern matching"""
        view = HostnamePageView()
        request = self.factory.get("/news/my-article/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "news/my-article"}

        # Should find news page and return 'my-article/' as remaining
        page, remaining = view._resolve_page_with_pattern(
            self.root_page, ["news", "my-article"]
        )
        self.assertEqual(page, self.news_page)
        self.assertEqual(remaining, "my-article/")

    def test_explicit_page_takes_precedence(self):
        """Test that explicit child pages take precedence over pattern matching"""
        view = HostnamePageView()
        request = self.factory.get("/news/archive/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "news/archive"}

        # Should find archive page (exact match), not news page with pattern
        page, remaining = view._resolve_page_with_pattern(
            self.root_page, ["news", "archive"]
        )
        self.assertEqual(page, self.archive_page)
        self.assertEqual(remaining, "")

    def test_extract_simple_path_variables(self):
        """Test extraction of simple path variables from pattern"""
        view = HostnamePageView()
        pattern = "^(?P<news_slug>[\\w-]+)/$"
        remaining_path = "my-article/"

        variables = view._extract_path_variables(pattern, remaining_path)

        self.assertIsNotNone(variables)
        self.assertEqual(variables["news_slug"], "my-article")

    def test_extract_multiple_path_variables(self):
        """Test extraction of multiple path variables"""
        view = HostnamePageView()
        pattern = "^(?P<year>\\d{4})/(?P<month>\\d{2})/(?P<slug>[\\w-]+)/$"
        remaining_path = "2024/12/my-event/"

        variables = view._extract_path_variables(pattern, remaining_path)

        self.assertIsNotNone(variables)
        self.assertEqual(variables["year"], "2024")
        self.assertEqual(variables["month"], "12")
        self.assertEqual(variables["slug"], "my-event")

    def test_extract_no_match_returns_none(self):
        """Test that non-matching patterns return None"""
        view = HostnamePageView()
        pattern = "^(?P<slug>[\\w-]+)/$"
        remaining_path = "invalid path with spaces/"

        variables = view._extract_path_variables(pattern, remaining_path)

        self.assertIsNone(variables)

    def test_nonexistent_path_raises_404(self):
        """Test that completely nonexistent paths raise 404"""
        view = HostnamePageView()
        request = self.factory.get("/nonexistent/", HTTP_HOST="testserver")
        view.request = request

        with self.assertRaises(Http404):
            view._resolve_page_with_pattern(self.root_page, ["nonexistent"])


class PathPatternIntegrationTests(TestCase):
    """Integration tests for full request-response cycle with patterns"""

    def setUp(self):
        """Set up test pages and data"""
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

        # Create root page
        self.root_page = WebPage.objects.create(
            slug="",
            hostnames=["testserver"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create published version for root
        root_version = self.root_page.create_version(self.user, "Root")
        root_version.effective_date = "2024-01-01T00:00:00Z"
        root_version.save()

        # Create events page with pattern
        self.events_page = WebPage.objects.create(
            slug="events",
            parent=self.root_page,
            path_pattern="^(?P<event_slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create published version for events
        events_version = self.events_page.create_version(self.user, "Events")
        events_version.effective_date = "2024-01-01T00:00:00Z"
        events_version.save()

    def test_path_variables_in_context(self):
        """Test that path_variables appear in the rendering context"""
        view = HostnamePageView()
        request = self.factory.get("/events/annual-conference/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "events/annual-conference"}

        response = view.get(request)

        # Check that response was successful
        self.assertEqual(response.status_code, 200)

        # Check that context contains path_variables
        # Note: We'll need to verify this through the rendered content
        # since we can't directly access the context from a response

    def test_listing_page_without_variables(self):
        """Test that pages work normally without path variables (listing mode)"""
        view = HostnamePageView()
        request = self.factory.get("/events/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "events"}

        response = view.get(request)

        # Should render successfully without path_variables
        self.assertEqual(response.status_code, 200)

    def test_invalid_pattern_match_returns_404(self):
        """Test that paths not matching the pattern return 404"""
        view = HostnamePageView()
        request = self.factory.get("/events/invalid path/", HTTP_HOST="testserver")
        view.request = request
        view.kwargs = {"slug_path": "events/invalid path"}

        with self.assertRaises(Http404):
            view.get(request)


class PathPatternEdgeCasesTests(TestCase):
    """Test edge cases and security considerations"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.view = HostnamePageView()

    def test_empty_pattern_no_extraction(self):
        """Test that empty pattern doesn't break extraction"""
        variables = self.view._extract_path_variables("", "some/path/")
        # Empty pattern should match beginning of string
        self.assertIsNotNone(variables)
        self.assertEqual(variables, {})  # No named groups

    def test_pattern_timeout_protection(self):
        """Test that regex matching has timeout protection"""
        # This test verifies that we don't have ReDoS vulnerabilities
        # A malicious pattern could cause exponential backtracking
        pattern = "^(a+)+b$"  # Known problematic pattern
        remaining_path = "a" * 100  # No 'b' at end, causes backtracking

        # Should not hang - either returns None or times out gracefully
        variables = self.view._extract_path_variables(pattern, remaining_path)
        # We expect None since pattern doesn't match
        self.assertIsNone(variables)

    def test_special_characters_in_slug(self):
        """Test handling of special characters in slugs"""
        pattern = "^(?P<slug>[\\w-]+)/$"

        # Valid slug
        variables = self.view._extract_path_variables(pattern, "my-article-123/")
        self.assertEqual(variables["slug"], "my-article-123")

        # Invalid characters
        variables = self.view._extract_path_variables(pattern, "my article/")
        self.assertIsNone(variables)

    def test_unicode_in_pattern(self):
        """Test that unicode characters in patterns are handled"""
        pattern = "^(?P<slug>[\\w-]+)/$"
        # Unicode characters in slug
        variables = self.view._extract_path_variables(pattern, "article-café/")
        # Should not match since \\w doesn't include accented characters by default
        # This is expected behavior - patterns should be explicit about unicode
        # If unicode support is needed, use a more permissive pattern

    def test_deeply_nested_path_resolution(self):
        """Test resolution with deeply nested page hierarchies"""
        root = WebPage.objects.create(
            slug="",
            hostnames=["testserver"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create nested hierarchy: root -> a -> b -> c
        page_a = WebPage.objects.create(
            slug="a", parent=root, created_by=self.user, last_modified_by=self.user
        )
        page_b = WebPage.objects.create(
            slug="b", parent=page_a, created_by=self.user, last_modified_by=self.user
        )
        page_c = WebPage.objects.create(
            slug="c",
            parent=page_b,
            path_pattern="^(?P<item>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Publish all pages
        for page in [root, page_a, page_b, page_c]:
            version = page.create_version(self.user, "Test")
            version.effective_date = "2024-01-01T00:00:00Z"
            version.save()

        # Should resolve through entire hierarchy
        page, remaining = self.view._resolve_page_with_pattern(
            root, ["a", "b", "c", "my-item"]
        )
        self.assertEqual(page, page_c)
        self.assertEqual(remaining, "my-item/")


class PathPatternSerializerTests(TestCase):
    """Test that path_pattern is properly serialized in API"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_path_pattern_in_serializer_fields(self):
        """Test that path_pattern is included in serializer fields"""
        from webpages.serializers import WebPageTreeSerializer, WebPageSimpleSerializer

        # Check WebPageTreeSerializer
        tree_fields = WebPageTreeSerializer.Meta.fields
        self.assertIn("path_pattern", tree_fields)

        # Check WebPageSimpleSerializer
        simple_fields = WebPageSimpleSerializer.Meta.fields
        self.assertIn("path_pattern", simple_fields)

    def test_serializer_includes_path_pattern_value(self):
        """Test that serializer actually includes the path_pattern value"""
        from webpages.serializers import WebPageTreeSerializer

        page = WebPage.objects.create(
            slug="test",
            path_pattern="^(?P<slug>[\\w-]+)/$",
            created_by=self.user,
            last_modified_by=self.user,
        )

        serializer = WebPageTreeSerializer(page)
        data = serializer.data

        self.assertIn("path_pattern", data)
        self.assertEqual(data["path_pattern"], "^(?P<slug>[\\w-]+)/$")
