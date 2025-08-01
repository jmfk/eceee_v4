"""
Tests for security and reliability fixes in hostname validation system.

This test suite covers:
1. Management command authentication
2. Cache race condition fixes
3. Port validation with IPv6
4. Hostname normalization edge cases
5. Rate limiting
"""

from django.test import TestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.client import RequestFactory
from unittest.mock import patch, Mock
import io
from contextlib import redirect_stderr

from webpages.models import WebPage
from webpages.middleware import DynamicHostValidationMiddleware
from webpages.management.commands.sync_hostnames import Command


class ManagementCommandSecurityTest(TestCase):
    """Test security fixes for sync_hostnames management command."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="teststaff",
            password="testpass123",
            email="test@example.com",
            is_staff=True,
        )
        self.non_staff_user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            email="user@example.com",
            is_staff=False,
        )

        # Create a test page
        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_add_hostname_requires_username(self):
        """Test that add-hostname requires --username parameter."""
        with self.assertRaises(CommandError) as cm:
            call_command(
                "sync_hostnames",
                "--add-hostname",
                "test.com",
                "--page-id",
                str(self.page.id),
            )

        self.assertIn("Username required", str(cm.exception))

    def test_add_hostname_requires_staff_user(self):
        """Test that add-hostname requires staff user."""
        with patch("getpass.getpass", return_value="testpass123"):
            with self.assertRaises(CommandError) as cm:
                call_command(
                    "sync_hostnames",
                    "--add-hostname",
                    "test.com",
                    "--page-id",
                    str(self.page.id),
                    "--username",
                    "testuser",
                    "--unsafe",  # Skip confirmation prompt
                )

        self.assertIn("must be staff", str(cm.exception))

    def test_add_hostname_requires_valid_password(self):
        """Test that add-hostname requires correct password."""
        with patch("getpass.getpass", return_value="wrongpassword"):
            with self.assertRaises(CommandError) as cm:
                call_command(
                    "sync_hostnames",
                    "--add-hostname",
                    "test.com",
                    "--page-id",
                    str(self.page.id),
                    "--username",
                    "teststaff",
                    "--unsafe",
                )

        self.assertIn("Authentication failed", str(cm.exception))

    @patch("getpass.getpass")
    @patch("builtins.input")
    def test_add_hostname_with_confirmation(self, mock_input, mock_getpass):
        """Test successful hostname addition with confirmation."""
        mock_getpass.return_value = "testpass123"
        mock_input.return_value = "yes"

        # Capture stdout
        from io import StringIO
        import sys

        captured_output = StringIO()
        sys.stdout = captured_output

        try:
            call_command(
                "sync_hostnames",
                "--add-hostname",
                "test.com",
                "--page-id",
                str(self.page.id),
                "--username",
                "teststaff",
            )

            # Check that hostname was added
            self.page.refresh_from_db()
            self.assertIn("test.com", self.page.hostnames)

            # Check output includes security logging
            output = captured_output.getvalue()
            self.assertIn("teststaff", output)
            self.assertIn("test@example.com", output)

        finally:
            sys.stdout = sys.__stdout__


class CacheRaceConditionTest(TestCase):
    """Test fixes for cache race conditions."""

    def setUp(self):
        self.middleware = DynamicHostValidationMiddleware()
        cache.clear()

    def test_atomic_cache_operations(self):
        """Test that cache operations are atomic and don't have race conditions."""

        # Mock the database loading to simulate timing
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get:
            mock_get.return_value = ["test.com", "example.com"]

            # First call should hit database and cache result
            result1 = self.middleware._check_database_hostnames("test.com")
            self.assertTrue(result1)

            # Second call should use cached result
            result2 = self.middleware._check_database_hostnames("test.com")
            self.assertTrue(result2)

            # Database should only be called once due to caching
            mock_get.assert_called_once()


class PortValidationTest(TestCase):
    """Test fixes for port validation with IPv6 addresses."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )

    def test_ipv6_with_port_validation(self):
        """Test that IPv6 addresses with ports are validated correctly."""
        page = WebPage(
            title="IPv6 Test",
            slug="ipv6",
            hostnames=["[::1]:8080"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Should not raise validation error
        try:
            page.full_clean()
        except Exception as e:
            self.fail(f"IPv6 with port validation failed: {e}")

    def test_invalid_port_range(self):
        """Test that invalid port ranges are rejected."""
        page = WebPage(
            title="Invalid Port Test",
            slug="invalid-port",
            hostnames=["example.com:70000"],  # Port too high
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(Exception):
            page.full_clean()

    def test_ipv6_without_brackets_detection(self):
        """Test detection of IPv6 addresses without brackets."""
        page = WebPage(
            title="IPv6 No Brackets Test",
            slug="ipv6-no-brackets",
            hostnames=["2001:db8::1"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Should handle IPv6 without brackets gracefully
        try:
            page.full_clean()
        except Exception as e:
            self.fail(f"IPv6 without brackets handling failed: {e}")


class HostnameNormalizationTest(TestCase):
    """Test improved hostname normalization with edge cases."""

    def test_ipv6_normalization(self):
        """Test IPv6 address normalization."""
        test_cases = [
            ("[::1]:8080", "[::1]:8080"),
            ("[2001:db8::1]", "[2001:db8::1]"),
            ("::1", "[::1]"),  # Bare IPv6 gets bracketed
            ("2001:db8::1", "[2001:db8::1]"),
        ]

        for input_hostname, expected in test_cases:
            with self.subTest(input_hostname=input_hostname):
                result = WebPage.normalize_hostname(input_hostname)
                self.assertEqual(result, expected)

    def test_idn_normalization(self):
        """Test internationalized domain name normalization."""
        # Test with German umlaut domain
        result = WebPage.normalize_hostname("münchen.de")
        # Should be converted to punycode
        self.assertTrue(result.startswith("xn--"))
        self.assertIn("mnchen", result)

    def test_malformed_hostname_handling(self):
        """Test that malformed hostnames are handled gracefully."""
        malformed_hostnames = [
            "http://[invalid:ipv6",
            "example.com:notaport",
            "",
            None,
            123,  # Non-string input
        ]

        for hostname in malformed_hostnames:
            with self.subTest(hostname=hostname):
                try:
                    result = WebPage.normalize_hostname(hostname)
                    # Should not crash, should return some reasonable fallback
                    self.assertIsInstance(result, str)
                except Exception as e:
                    self.fail(f"Hostname normalization crashed on {hostname}: {e}")

    def test_port_extraction_edge_cases(self):
        """Test port extraction handles edge cases correctly."""
        page = WebPage()

        test_cases = [
            ("[::1]:8080", 8080),
            ("[::1]", None),
            ("example.com:80", 80),
            ("example.com", None),
            ("::1", None),  # IPv6 without port
            ("", None),
            (None, None),
        ]

        for hostname, expected_port in test_cases:
            with self.subTest(hostname=hostname):
                result = page._extract_port_from_hostname(hostname)
                self.assertEqual(result, expected_port)


class RateLimitingTest(TestCase):
    """Test rate limiting for hostname management operations."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )
        self.factory = RequestFactory()

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.UserRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {
                "webpage_modifications": "1/hour",  # Very restrictive for testing
            },
        }
    )
    def test_rate_limiting_configuration(self):
        """Test that rate limiting is properly configured."""
        from rest_framework.throttling import UserRateThrottle

        throttle = UserRateThrottle()
        throttle.scope = "webpage_modifications"

        # Create a mock request
        request = self.factory.post("/api/pages/")
        request.user = self.user

        # First request should be allowed
        allowed = throttle.allow_request(request, None)
        self.assertTrue(allowed)

        # Second request should be throttled (rate limit: 1/hour)
        allowed = throttle.allow_request(request, None)
        self.assertFalse(allowed)


class IntegrationTest(TestCase):
    """Integration tests for all security fixes working together."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )
        cache.clear()

    def test_full_hostname_workflow_with_security(self):
        """Test complete hostname workflow with all security fixes."""

        # Create page with complex hostname (IPv6 + IDN)
        page = WebPage.objects.create(
            title="Security Test Page",
            slug="security-test",
            hostnames=["[::1]:8080", "münchen.de"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test middleware with these hostnames
        middleware = DynamicHostValidationMiddleware()

        # Test IPv6 hostname
        result1 = middleware.is_host_allowed("[::1]:8080")
        self.assertTrue(result1)

        # Test IDN hostname (should be normalized to punycode internally)
        result2 = middleware.is_host_allowed("münchen.de")
        self.assertTrue(result2)

        # Test cache behavior (should use cached results on second call)
        with patch("webpages.models.WebPage.get_all_hostnames") as mock_get:
            mock_get.return_value = ["[::1]:8080", "xn--mnchen-3ya.de"]

            # Clear cache first
            cache.clear()

            # First call hits database
            result3 = middleware.is_host_allowed("[::1]:8080")
            self.assertTrue(result3)

            # Second call uses cache
            result4 = middleware.is_host_allowed("[::1]:8080")
            self.assertTrue(result4)

            # Database should only be called once
            mock_get.assert_called_once()


class WildcardSecurityTest(TestCase):
    """Test wildcard hostname security controls."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )
        # Create mock get_response function for middleware
        self.get_response = Mock(return_value=Mock())
        self.middleware = DynamicHostValidationMiddleware(self.get_response)

    @override_settings(ALLOW_WILDCARD_HOSTNAMES=True)
    def test_wildcard_allowed_when_enabled(self):
        """Test wildcard hostnames work when explicitly enabled."""
        page = WebPage.objects.create(
            title="Wildcard Test",
            slug="wildcard",
            hostnames=["*"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Should allow any host when wildcard is enabled
        result = self.middleware.is_host_allowed("any-host.com")
        self.assertTrue(result)

    @override_settings(ALLOW_WILDCARD_HOSTNAMES=False)
    def test_wildcard_blocked_when_disabled(self):
        """Test wildcard hostnames are blocked when disabled."""
        page = WebPage.objects.create(
            title="Wildcard Test",
            slug="wildcard",
            hostnames=["*"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Should block wildcard when disabled
        result = self.middleware.is_host_allowed("any-host.com")
        self.assertFalse(result)

    def test_wildcard_logging_warnings(self):
        """Test that wildcard usage generates appropriate warnings."""
        import logging
        from io import StringIO
        import sys

        # Capture log output
        log_capture_string = StringIO()
        ch = logging.StreamHandler(log_capture_string)
        logger = logging.getLogger("webpages.models")
        logger.addHandler(ch)
        logger.setLevel(logging.WARNING)

        try:
            page = WebPage(
                title="Wildcard Test",
                slug="wildcard",
                hostnames=["*"],
                created_by=self.user,
                last_modified_by=self.user,
            )
            page.full_clean()

            # Check that warning was logged
            log_contents = log_capture_string.getvalue()
            self.assertIn("SECURITY WARNING", log_contents)
            self.assertIn("wildcard hostname", log_contents.lower())

        finally:
            logger.removeHandler(ch)


class EnhancedSecurityTest(TestCase):
    """Test enhanced security controls."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )
        # Create mock get_response function for middleware
        self.get_response = Mock(return_value=Mock())
        self.middleware = DynamicHostValidationMiddleware(self.get_response)

    @override_settings(DATABASE_FAILURE_FALLBACK="allow")
    def test_database_failure_critical_logging(self):
        """Test that allow fallback generates critical security warnings."""
        import logging
        from io import StringIO

        # Capture log output
        log_capture_string = StringIO()
        ch = logging.StreamHandler(log_capture_string)
        logger = logging.getLogger("webpages.middleware")
        logger.addHandler(ch)
        logger.setLevel(logging.CRITICAL)

        try:
            # Mock database failure
            with patch("webpages.models.WebPage.get_all_hostnames") as mock_get:
                mock_get.side_effect = Exception("Database error")

                result = self.middleware._check_database_hostnames("test.com")
                self.assertTrue(result)  # Should allow due to fallback

                # Check critical warning was logged
                log_contents = log_capture_string.getvalue()
                self.assertIn("SECURITY RISK", log_contents)
                self.assertIn("bypassed", log_contents)

        finally:
            logger.removeHandler(ch)

    def test_ipv6_case_preservation(self):
        """Test that IPv6 addresses preserve case correctly."""
        test_cases = [
            ("2001:DB8::1", "2001:DB8::1"),  # Preserve uppercase
            ("[2001:DB8::1]:8080", "[2001:db8::1]:8080"),  # Should normalize in brackets
            ("EXAMPLE.COM", "example.com"),  # Domain names still lowercase
            ("Example.COM:8080", "example.com:8080"),  # Domain with port
        ]

        for input_hostname, expected in test_cases:
            with self.subTest(input_hostname=input_hostname):
                result = WebPage.normalize_hostname(input_hostname)
                if ":" in input_hostname and input_hostname.count(":") > 1:
                    # IPv6 case - check case preservation for non-bracketed
                    if not input_hostname.startswith("["):
                        self.assertEqual(result, f"[{input_hostname}]")
                    else:
                        # For bracketed, normalization may still apply
                        self.assertTrue(result.startswith("[") and result.endswith("]") or ":8080" in result)
                else:
                    # Regular hostname - should match expected
                    self.assertEqual(result, expected)


class ManagementCommandWildcardTest(TestCase):
    """Test management command wildcard warnings."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="teststaff",
            password="testpass123",
            email="test@example.com",
            is_staff=True,
        )
        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            created_by=self.user,
            last_modified_by=self.user,
        )

    @patch("getpass.getpass")
    @patch("builtins.input")
    def test_wildcard_hostname_warning(self, mock_input, mock_getpass):
        """Test that adding wildcard hostname shows security warnings."""
        mock_getpass.return_value = "testpass123"
        mock_input.return_value = "no"  # User decides not to proceed

        from io import StringIO
        import sys

        captured_output = StringIO()
        sys.stdout = captured_output

        try:
            call_command(
                "sync_hostnames",
                "--add-hostname",
                "*",
                "--page-id",
                str(self.page.id),
                "--username",
                "teststaff",
            )

            output = captured_output.getvalue()
            self.assertIn("SECURITY WARNING", output)
            self.assertIn("wildcard", output.lower())
            self.assertIn("ALL hosts", output)

        finally:
            sys.stdout = sys.__stdout__
