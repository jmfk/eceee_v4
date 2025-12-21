"""
Tests for dynamic ALLOWED_HOSTS functionality.
"""

from django.test import TestCase, override_settings
from django.core.cache import cache
from django.http import HttpRequest, HttpResponseBadRequest
from django.contrib.auth.models import User
from unittest.mock import patch, Mock

from webpages.models import WebPage
from core.models import Tenant
from webpages.middleware import (
    DynamicHostValidationMiddleware,
    get_dynamic_allowed_hosts,
)


class DynamicHostValidationTest(TestCase):
    """Test dynamic hostname validation middleware."""

    def setUp(self):
        """Set up test data."""
        # Create a mock get_response function for middleware
        self.get_response = Mock(return_value=Mock())
        self.middleware = DynamicHostValidationMiddleware(self.get_response)

        # Create a test user for WebPage creation
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create a test tenant
        self.tenant = Tenant.objects.create(
            name="Test Tenant", identifier="test", created_by=self.user
        )

        # Clear cache before each test
        cache.clear()

    def tearDown(self):
        """Clean up after each test."""
        cache.clear()

    def test_static_allowed_hosts_validation(self):
        """Test validation against static ALLOWED_HOSTS."""
        with override_settings(STATIC_ALLOWED_HOSTS=["example.com", "localhost"]):
            # Should allow static hosts
            self.assertTrue(self.middleware.is_host_allowed("example.com"))
            self.assertTrue(self.middleware.is_host_allowed("localhost"))

            # Should reject unknown hosts
            self.assertFalse(self.middleware.is_host_allowed("evil.com"))

    def test_database_hostname_validation(self):
        """Test validation against database hostnames."""
        # Create a root page with hostnames
        page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            hostnames=["test.example.com", "app.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Should allow database hostnames
        self.assertTrue(self.middleware.is_host_allowed("test.example.com"))
        self.assertTrue(self.middleware.is_host_allowed("app.example.com"))

        # Should reject unknown hostnames
        self.assertFalse(self.middleware.is_host_allowed("unknown.com"))

    @override_settings(ALLOW_WILDCARD_HOSTNAMES=True)
    def test_wildcard_hostname(self):
        """Test wildcard hostname functionality."""
        # Create page with wildcard
        page = WebPage.objects.create(
            title="Wildcard Page",
            slug="wildcard",
            hostnames=["*"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Should allow any hostname
        self.assertTrue(self.middleware.is_host_allowed("anything.com"))
        self.assertTrue(self.middleware.is_host_allowed("random.example.org"))

    def test_hostname_normalization(self):
        """Test hostname normalization."""
        page = WebPage.objects.create(
            title="Norm Test",
            slug="norm",
            hostnames=["example.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Should normalize and match various formats
        self.assertTrue(self.middleware.is_host_allowed("EXAMPLE.COM"))
        self.assertTrue(self.middleware.is_host_allowed("example.com"))

    def test_cache_behavior(self):
        """Test caching of database hostnames."""
        # Create page
        page = WebPage.objects.create(
            title="Cache Test",
            slug="cache",
            hostnames=["cache.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # First call should hit database and cache result
        self.assertTrue(self.middleware.is_host_allowed("cache.example.com"))

        # Verify cache was populated
        cache_key = DynamicHostValidationMiddleware.get_cache_key()
        cached_hostnames = cache.get(cache_key)
        self.assertIsNotNone(cached_hostnames)
        self.assertIn("cache.example.com", cached_hostnames)

    def test_cache_invalidation_on_save(self):
        """Test that cache is cleared when hostnames are updated."""
        # Create page
        page = WebPage.objects.create(
            title="Cache Invalidation Test",
            slug="cache-inv",
            hostnames=["old.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Populate cache
        self.middleware.is_host_allowed("old.example.com")
        cache_key = DynamicHostValidationMiddleware.get_cache_key()
        self.assertIsNotNone(cache.get(cache_key))

        # Update hostnames
        page.hostnames = ["new.example.com"]
        page.save()

        # Cache should be cleared
        self.assertIsNone(cache.get(cache_key))

    def test_get_dynamic_allowed_hosts(self):
        """Test the get_dynamic_allowed_hosts utility function."""
        with override_settings(STATIC_ALLOWED_HOSTS=["static1.com", "static2.com"]):
            # Create page with database hostnames
            page = WebPage.objects.create(
                title="Combined Test",
                slug="combined",
                hostnames=["db1.com", "db2.com"],
                created_by=self.user,
                last_modified_by=self.user,
                tenant=self.tenant,
            )

            all_hosts = get_dynamic_allowed_hosts()

            # Should include both static and database hosts
            self.assertIn("static1.com", all_hosts)
            self.assertIn("static2.com", all_hosts)
            self.assertIn("db1.com", all_hosts)
            self.assertIn("db2.com", all_hosts)

            # Should not have duplicates
            self.assertEqual(len(all_hosts), len(set(all_hosts)))

    def test_middleware_process_request(self):
        """Test middleware request processing."""
        with override_settings(STATIC_ALLOWED_HOSTS=["allowed.com"]):
            # Create mock request
            request = HttpRequest()
            request.META["HTTP_HOST"] = "allowed.com"

            # Should allow valid host
            response = self.middleware.process_request(request)
            self.assertIsNone(response)  # None means continue processing

            # Should reject invalid host
            request.META["HTTP_HOST"] = "evil.com"
            response = self.middleware.process_request(request)
            self.assertIsInstance(response, HttpResponseBadRequest)

    @override_settings(DEBUG=True, SKIP_HOST_VALIDATION_IN_DEBUG=True)
    def test_skip_validation_in_debug(self):
        """Test skipping validation in debug mode."""
        request = HttpRequest()
        request.META["HTTP_HOST"] = "any-host-should-work.com"

        response = self.middleware.process_request(request)
        self.assertIsNone(response)  # Should be allowed

    def test_error_handling_with_database_unavailable_default_deny(self):
        """Test graceful handling when database is unavailable with default 'deny' strategy."""
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get_hostnames:
            mock_get_hostnames.side_effect = Exception("Database error")

            # Should not raise exception, should return False (deny) by default
            result = self.middleware._check_database_hostnames("test.com")
            self.assertFalse(result)

    @override_settings(DATABASE_FAILURE_FALLBACK="allow")
    def test_database_failure_fallback_allow_strategy(self):
        """Test database failure fallback with 'allow' strategy."""
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get_hostnames:
            mock_get_hostnames.side_effect = Exception("Database error")

            # Should allow any host when strategy is 'allow'
            result = self.middleware._check_database_hostnames("any-host.com")
            self.assertTrue(result)

    @override_settings(
        DATABASE_FAILURE_FALLBACK="static_only",
        STATIC_ALLOWED_HOSTS=["allowed.com", "localhost"],
    )
    def test_database_failure_fallback_static_only_strategy(self):
        """Test database failure fallback with 'static_only' strategy."""
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get_hostnames:
            mock_get_hostnames.side_effect = Exception("Database error")

            # Should check against static hosts when strategy is 'static_only'
            result_allowed = self.middleware._check_database_hostnames("allowed.com")
            self.assertTrue(result_allowed)

            result_denied = self.middleware._check_database_hostnames("not-allowed.com")
            self.assertFalse(result_denied)

    @override_settings(DATABASE_FAILURE_FALLBACK="deny")
    def test_database_failure_fallback_deny_strategy(self):
        """Test database failure fallback with explicit 'deny' strategy."""
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get_hostnames:
            mock_get_hostnames.side_effect = Exception("Database error")

            # Should deny all hosts when strategy is 'deny'
            result = self.middleware._check_database_hostnames("any-host.com")
            self.assertFalse(result)

    @override_settings(DATABASE_FAILURE_FALLBACK="invalid_strategy")
    def test_database_failure_fallback_invalid_strategy_defaults_to_deny(self):
        """Test database failure fallback with invalid strategy defaults to 'deny'."""
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get_hostnames:
            mock_get_hostnames.side_effect = Exception("Database error")

            # Should default to deny for invalid strategy
            result = self.middleware._check_database_hostnames("any-host.com")
            self.assertFalse(result)

    def test_secure_cache_key_generation(self):
        """Test that cache keys are secure and unpredictable."""
        # Get cache key from middleware instance
        cache_key = self.middleware.get_cache_key()

        # Should be prefixed with 'dhv_'
        self.assertTrue(cache_key.startswith("dhv_"))

        # Should not contain predictable strings
        self.assertNotIn("webpages_allowed_hosts", cache_key)
        self.assertNotIn("hostnames", cache_key.lower())

        # Should be consistent for same SECRET_KEY
        cache_key2 = self.middleware.get_cache_key()
        self.assertEqual(cache_key, cache_key2)

    @override_settings(HOSTNAME_CACHE_KEY_PREFIX="custom_prefix")
    def test_configurable_cache_key_prefix(self):
        """Test that cache key prefix is configurable."""
        cache_key = self.middleware.get_cache_key()

        # Should still be secure format
        self.assertTrue(cache_key.startswith("dhv_"))

        # Changing prefix should change the key
        with override_settings(HOSTNAME_CACHE_KEY_PREFIX="different_prefix"):
            different_key = self.middleware.get_cache_key()
            self.assertNotEqual(cache_key, different_key)

    def test_cache_key_uses_secret_key(self):
        """Test that cache key changes with SECRET_KEY for security."""
        original_cache_key = self.middleware.get_cache_key()

        # Mock a different SECRET_KEY
        with override_settings(SECRET_KEY="different-secret-key-for-testing"):
            different_cache_key = self.middleware.get_cache_key()

        # Keys should be different with different SECRET_KEY
        self.assertNotEqual(original_cache_key, different_cache_key)

    def test_clear_hostname_cache_with_secure_key(self):
        """Test that clear_hostname_cache works with the new secure cache key."""
        # Populate cache manually
        cache_key = self.middleware.get_cache_key()
        test_hostnames = ["test.com", "example.com"]
        cache.set(cache_key, test_hostnames, 300)

        # Verify cache is populated
        self.assertEqual(cache.get(cache_key), test_hostnames)

        # Clear cache using the class method
        DynamicHostValidationMiddleware.clear_hostname_cache()

        # Verify cache is cleared
        self.assertIsNone(cache.get(cache_key))

    def test_non_root_page_hostnames_validation(self):
        """Test that non-root pages cannot have hostnames."""
        # Create root page
        root = WebPage.objects.create(
            title="Root",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Create child page with hostnames (should fail validation)
        child = WebPage(
            title="Child",
            slug="child",
            parent=root,
            hostnames=["child.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        with self.assertRaises(Exception):  # ValidationError
            child.full_clean()

    def test_get_host_from_request(self):
        """Test the _get_host_from_request method."""
        # Test with HTTP_HOST header
        request = HttpRequest()
        request.META["HTTP_HOST"] = "example.com:8000"

        host = self.middleware._get_host_from_request(request)
        self.assertEqual(host, "example.com:8000")

        # Test with SERVER_NAME and SERVER_PORT fallback
        request = HttpRequest()
        request.META["SERVER_NAME"] = "example.com"
        request.META["SERVER_PORT"] = "8080"

        host = self.middleware._get_host_from_request(request)
        self.assertEqual(host, "example.com:8080")

        # Test with standard ports (should not include port)
        request = HttpRequest()
        request.META["SERVER_NAME"] = "example.com"
        request.META["SERVER_PORT"] = "80"

        host = self.middleware._get_host_from_request(request)
        self.assertEqual(host, "example.com")

    def test_hostname_with_ports(self):
        """Test hostname validation with ports."""
        # Create page with hostname including port
        page = WebPage.objects.create(
            title="Port Test",
            slug="port-test",
            hostnames=["example.com", "localhost"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Should allow hostnames even with different ports
        self.assertTrue(self.middleware.is_host_allowed("example.com:8000"))
        self.assertTrue(self.middleware.is_host_allowed("localhost:3000"))
        self.assertTrue(self.middleware.is_host_allowed("example.com:9000"))


class HostnameUtilsTest(TestCase):
    """Test hostname utility functions."""

    def setUp(self):
        """Set up test data."""
        # Create a test user for WebPage creation
        self.user = User.objects.create_user(
            username="testuser2", email="test2@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant 2", identifier="test2", created_by=self.user
        )

    def test_hostname_normalization(self):
        """Test WebPage.normalize_hostname method."""
        test_cases = [
            ("http://example.com", "example.com"),
            ("https://example.com/path", "example.com"),
            ("EXAMPLE.COM", "example.com"),
            ("localhost:8000", "localhost"),  # Port should be stripped
            ("sub.domain.com:443", "sub.domain.com"),  # Port should be stripped
            ("[::1]:8080", "[::1]"),  # IPv6 port should be stripped
            ("", ""),
            (None, ""),
        ]

        for input_hostname, expected in test_cases:
            result = WebPage.normalize_hostname(input_hostname)
            self.assertEqual(result, expected, f"Failed for input: {input_hostname}")

    def test_hostname_validation_patterns(self):
        """Test hostname validation regex patterns."""
        # Create a test page to trigger validation
        valid_hostnames = [
            "example.com",
            "sub.example.com",
            "localhost",
            "localhost:8000",
            "app.site.co.uk:3000",
            "*",
            "default",
        ]

        for hostname in valid_hostnames:
            try:
                page = WebPage.objects.create(
                    title=f"Test {hostname}",
                    slug=f'test-{hostname.replace(".", "-").replace(":", "-").replace("*", "star")}',
                    hostnames=[hostname],
                    created_by=self.user,
                    last_modified_by=self.user,
                    tenant=self.tenant,
                )
                page.full_clean()  # Should not raise ValidationError
                page.delete()  # Clean up
            except Exception as e:
                self.fail(f"Valid hostname '{hostname}' was rejected: {e}")

    def test_get_all_hostnames(self):
        """Test WebPage.get_all_hostnames class method."""
        # Create multiple pages with hostnames
        page1 = WebPage.objects.create(
            title="Page 1",
            slug="page1",
            hostnames=["site1.com", "www.site1.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        page2 = WebPage.objects.create(
            title="Page 2",
            slug="page2",
            hostnames=["site2.com"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        # Create child page (should not contribute hostnames)
        child = WebPage.objects.create(
            title="Child",
            slug="child",
            parent=page1,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

        all_hostnames = WebPage.get_all_hostnames()

        # Should include hostnames from root pages only
        self.assertIn("site1.com", all_hostnames)
        self.assertIn("www.site1.com", all_hostnames)
        self.assertIn("site2.com", all_hostnames)

        # Should be sorted
        self.assertEqual(all_hostnames, sorted(all_hostnames))


class AdminIntegrationTest(TestCase):
    """Test admin integration with hostname cache clearing."""

    def test_admin_mixin_integration(self):
        """Test that admin uses HostnameUpdateMixin."""
        from webpages.admin import WebPageAdmin
        from webpages.middleware import HostnameUpdateMixin

        # Check that WebPageAdmin inherits from HostnameUpdateMixin
        self.assertTrue(issubclass(WebPageAdmin, HostnameUpdateMixin))
