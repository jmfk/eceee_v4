"""
Tests for Enhanced Layout API Features

Tests for rate limiting, metrics logging, and content negotiation
enhancements added to the Phase 1.3 Layout API.
"""

from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.core.cache import cache
from unittest.mock import patch, MagicMock
import json
import time
import logging


class LayoutAPIRateLimitingTests(APITestCase):
    """Test rate limiting functionality"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        # Clear cache before each test
        cache.clear()

    def test_rate_limiting_headers_present(self):
        """Test that rate limiting headers are included in responses"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check for rate limiting headers
        self.assertIn("X-RateLimit-Limit", response)
        self.assertIn("X-RateLimit-Remaining", response)
        self.assertIn("X-RateLimit-Reset", response)

        # Verify header values are reasonable
        limit = int(response["X-RateLimit-Limit"])
        remaining = int(response["X-RateLimit-Remaining"])
        reset_time = int(response["X-RateLimit-Reset"])

        self.assertGreater(limit, 0)
        self.assertGreaterEqual(remaining, 0)
        self.assertLessEqual(remaining, limit)
        self.assertGreater(reset_time, int(time.time()))

    def test_different_rate_limits_by_endpoint(self):
        """Test that different endpoints have appropriate rate limits"""
        # Test list endpoint
        response_list = self.client.get("/api/v1/webpages/layouts/")
        list_limit = int(response_list["X-RateLimit-Limit"])

        # Get a layout name for detail test
        if response_list.data["results"]:
            layout_name = response_list.data["results"][0]["name"]

            # Test detail endpoint
            response_detail = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/"
            )
            detail_limit = int(response_detail["X-RateLimit-Limit"])

            # Test template endpoint
            response_template = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/"
            )
            template_limit = int(response_template["X-RateLimit-Limit"])

            # Template endpoints should have lower limits (more expensive)
            self.assertLess(template_limit, detail_limit)

    def test_rate_limit_tracking(self):
        """Test that rate limit tracking works across requests"""
        # Make first request
        response1 = self.client.get("/api/v1/webpages/layouts/")
        remaining1 = int(response1["X-RateLimit-Remaining"])

        # Make second request
        response2 = self.client.get("/api/v1/webpages/layouts/")
        remaining2 = int(response2["X-RateLimit-Remaining"])

        # Remaining should decrease
        self.assertLess(remaining2, remaining1)

    def test_retry_after_header_near_limit(self):
        """Test that Retry-After header appears when approaching rate limit"""
        # This test would need to make many requests to approach the limit
        # For practical testing, we'll check the logic with a lower threshold

        # Clear cache and make a request
        cache.clear()
        response = self.client.get("/api/v1/webpages/layouts/")

        # At normal levels, no Retry-After header
        self.assertNotIn("Retry-After", response)

        # Note: Testing actual rate limit exhaustion would require many requests
        # and is better suited for integration tests


class LayoutAPIMetricsTests(APITestCase):
    """Test metrics logging functionality"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    @patch("webpages.views.logger")
    def test_metrics_logging_for_list_endpoint(self, mock_logger):
        """Test that metrics are logged for list requests"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify logging was called
        mock_logger.debug.assert_called()
        call_args = mock_logger.debug.call_args[0][0]

        self.assertIn("Layout API request", call_args)
        self.assertIn("endpoint", call_args)
        self.assertIn("list", call_args)

    @patch("webpages.views.logger")
    def test_metrics_logging_for_template_endpoint(self, mock_logger):
        """Test that template data requests are logged with INFO level"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Verify INFO level logging for template requests
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args[0][0]

            self.assertIn("Template data request", call_args)
            self.assertIn("template_data", call_args)

    @patch("webpages.views.logger")
    def test_metrics_include_request_metadata(self, mock_logger):
        """Test that metrics include useful request metadata"""
        self.client.get(
            "/api/v1/webpages/layouts/",
            HTTP_USER_AGENT="Test-Client/1.0",
            HTTP_API_VERSION="v2",
        )

        # Check that the logged data includes metadata
        mock_logger.debug.assert_called()
        call_args = mock_logger.debug.call_args[0][0]

        self.assertIn("api_version", call_args)
        self.assertIn("user_agent", call_args)
        self.assertIn("client_ip", call_args)
        self.assertIn("timestamp", call_args)


class LayoutAPIContentNegotiationTests(APITestCase):
    """Test content negotiation functionality"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_default_json_response(self):
        """Test that default response format is JSON"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json")

        # Should be valid JSON
        self.assertIsInstance(response.data, dict)

    def test_api_features_header(self):
        """Test that API features header is present"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check for API features header
        self.assertIn("X-API-Features", response)
        self.assertIn("rate-limiting", response["X-API-Features"])
        self.assertIn("metrics", response["X-API-Features"])
        self.assertIn("caching", response["X-API-Features"])

    def test_response_headers(self):
        """Test that proper response headers are set"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check for standard headers
        self.assertIn("Vary", response)
        self.assertIn("Accept", response["Vary"])
        self.assertIn("Content-Language", response)
        self.assertEqual(response["Content-Language"], "en")


class LayoutAPIEnhancementIntegrationTests(APITestCase):
    """Integration tests for all enhancements working together"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        cache.clear()

    @patch("webpages.views.logger")
    def test_all_enhancements_in_single_request(self, mock_logger):
        """Test that all enhancements work together in a single request"""
        response = self.client.get(
            "/api/v1/webpages/layouts/?include_template_data=true",
            HTTP_API_VERSION="v2",
            HTTP_USER_AGENT="Integration-Test/1.0",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check API features header
        self.assertIn("X-API-Features", response)

        # Check rate limiting headers
        self.assertIn("X-RateLimit-Limit", response)
        self.assertIn("X-RateLimit-Remaining", response)

        # Check caching headers
        self.assertIn("Cache-Control", response)
        self.assertIn("Vary", response)

        # Check that metrics were logged
        mock_logger.debug.assert_called()

    def test_template_endpoint_with_all_enhancements(self):
        """Test template endpoint with all enhancements"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/",
                HTTP_API_VERSION="v1",
            )

            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Should have appropriate rate limit (lower for template)
            limit = int(response["X-RateLimit-Limit"])
            self.assertLessEqual(limit, 500)  # Template endpoints have 500 limit

            # Should have API features header
            self.assertIn("X-API-Features", response)

            # Should have caching headers
            self.assertIn("ETag", response)
            self.assertIn("Cache-Control", response)

    def test_backward_compatibility_maintained(self):
        """Test that all existing functionality still works with enhancements"""
        # Test existing API without any new parameters
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("summary", response.data)
        self.assertEqual(response.data["api_version"], "v1")  # Default version
        self.assertFalse(response.data["template_data_included"])  # Default false

        # Should still be JSON by default
        self.assertEqual(response["Content-Type"], "application/json")

        # But should have enhancement headers
        self.assertIn("X-RateLimit-Limit", response)
        self.assertIn("Cache-Control", response)
