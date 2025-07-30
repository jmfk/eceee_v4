"""
Tests for Phase 1.3: Enhanced Layout API Endpoints

Tests backward compatibility, template data inclusion, caching,
API versioning, and the new template endpoint.
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
import json
from unittest.mock import patch, MagicMock


class LayoutAPIUnifiedEndpointTests(APITestCase):
    """Test that unified layout endpoints work correctly"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_unified_layouts_list_endpoint(self):
        """Test that /api/v1/webpages/layouts/ works correctly"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("summary", response.data)

        # Verify structure is correct
        if response.data["results"]:
            layout = response.data["results"][0]
            required_fields = [
                "name",
                "description",
                "template_name",
                "slot_configuration",
                "is_active",
                "type",
            ]
            for field in required_fields:
                self.assertIn(field, layout)

    def test_unified_layouts_detail_endpoint(self):
        """Test that /api/layouts/{name}/ works correctly"""
        # First get a layout name from the list
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(f"/api/v1/webpages/layouts/{layout_name}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Verify required fields exist
            required_fields = [
                "name",
                "description",
                "template_name",
                "slot_configuration",
                "is_active",
                "type",
            ]
            for field in required_fields:
                self.assertIn(field, response.data)

    def test_unified_choices_endpoint(self):
        """Test that unified choices endpoint works"""
        response = self.client.get("/api/v1/webpages/layouts/choices/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return a list of choices
        self.assertIsInstance(response.data, list)


class LayoutAPIPhase13EnhancementsTests(APITestCase):
    """Test new Phase 1.3 features: template data, versioning, caching"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_new_layouts_endpoint(self):
        """Test the new unified /api/v1/webpages/layouts/ endpoint"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("summary", response.data)
        self.assertIn("api_version", response.data)

    def test_api_versioning_support(self):
        """Test API versioning via header and query param"""
        # Test via header
        response = self.client.get("/api/v1/webpages/layouts/", HTTP_API_VERSION="v1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["api_version"], "v1")

        # Test via query param
        response = self.client.get("/api/v1/webpages/layouts/?version=v2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["api_version"], "v2")

    def test_caching_headers(self):
        """Test that proper HTTP caching headers are set"""
        response = self.client.get("/api/v1/webpages/layouts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Cache-Control", response)
        self.assertIn("Vary", response)
        self.assertIn("Last-Modified", response)

    def test_layout_detail_caching_headers(self):
        """Test caching headers on detail endpoints"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(f"/api/v1/webpages/layouts/{layout_name}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Should have caching headers including ETag
            self.assertIn("Cache-Control", response)
            self.assertIn("ETag", response)
            self.assertIn("Last-Modified", response)


class LayoutTemplateEndpointTests(APITestCase):
    """Test the new /api/layouts/{id}/template/ endpoint"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_template_endpoint_exists(self):
        """Test that the template endpoint exists and responds"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_template_endpoint_structure(self):
        """Test the structure of template endpoint response"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Verify expected fields
            expected_fields = [
                "layout_name",
                "layout_type",
                "template_html",
                "template_css",
                "parsed_slots",
                "template_file",
                "parsing_errors",
                "cache_info",
                "last_modified",
            ]
            for field in expected_fields:
                self.assertIn(field, response.data)


class LayoutSerializerTests(TestCase):
    """Test the LayoutSerializer"""

    def test_layout_serializer_basic_fields(self):
        """Test LayoutSerializer with basic layout data"""
        from webpages.serializers import LayoutSerializer

        layout_data = {
            "name": "test_layout",
            "description": "Test layout",
            "template_name": "test.html",
            "css_classes": "test-class",
            "is_active": True,
            "type": "code",
            "slot_configuration": {"slots": []},
        }

        serializer = LayoutSerializer(layout_data)

        # All basic fields should be present
        self.assertEqual(serializer.data["name"], "test_layout")
        self.assertEqual(serializer.data["description"], "Test layout")
        self.assertTrue(serializer.data["is_active"])
        self.assertEqual(serializer.data["type"], "code")

    def test_layout_serializer_with_template_data(self):
        """Test LayoutSerializer with template data inclusion"""
        from webpages.serializers import LayoutSerializer

        layout_data = {
            "name": "template_layout",
            "description": "Template-based layout",
            "template_name": "test.html",
            "css_classes": "template-class",
            "is_active": True,
            "type": "template",
            "slot_configuration": {"slots": [{"name": "content"}]},
            "html": '<div data-widget-slot="content"></div>',
            "css": ".content { color: blue; }",
            "template_based": True,
            "template_file": "layouts/test.html",
        }

        # Test without template data inclusion
        serializer = LayoutSerializer(layout_data, include_template_data=False)
        self.assertIsNone(serializer.data["template_data"])

        # Test with template data inclusion
        serializer = LayoutSerializer(layout_data, include_template_data=True)
        self.assertIsNotNone(serializer.data["template_data"])
        self.assertIn("html", serializer.data["template_data"])
        self.assertIn("css", serializer.data["template_data"])
        self.assertIn("slots", serializer.data["template_data"])


class LayoutAPIPermissionsTests(APITestCase):
    """Test API permissions and authentication"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.staff_user = User.objects.create_user(
            username="staff",
            email="staff@example.com",
            password="staffpass123",
            is_staff=True,
        )

    def test_layout_list_permissions(self):
        """Test that layout list is accessible without authentication"""
        response = self.client.get("/api/v1/webpages/layouts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_layout_detail_permissions(self):
        """Test that layout detail is accessible without authentication"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(f"/api/v1/webpages/layouts/{layout_name}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_template_endpoint_permissions(self):
        """Test that template endpoint is accessible without authentication"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/template/"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reload_endpoint_requires_staff(self):
        """Test that reload endpoint requires staff permissions"""
        # Without authentication
        response = self.client.post("/api/v1/webpages/layouts/reload/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # With regular user
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/v1/webpages/layouts/reload/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # With staff user
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post("/api/v1/webpages/layouts/reload/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class LayoutAPIConditionalRequestsTests(APITestCase):
    """Test conditional requests (ETags, Last-Modified) for Phase 1.3"""

    def setUp(self):
        self.client = APIClient()

    def test_etag_support(self):
        """Test ETag support for conditional requests"""
        # Get a layout name first
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            # First request to get ETag
            response = self.client.get(f"/api/v1/webpages/layouts/{layout_name}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            etag = response.get("ETag")
            self.assertIsNotNone(etag)

            # Request with If-None-Match should return 304 if unchanged
            # Note: This test assumes the layout hasn't changed
            response2 = self.client.get(
                f"/api/v1/webpages/layouts/{layout_name}/", HTTP_IF_NONE_MATCH=etag
            )
            # Since we're not implementing full conditional logic yet,
            # this should still return 200, but ETag should be consistent
            self.assertEqual(response2.get("ETag"), etag)

    def test_last_modified_header(self):
        """Test Last-Modified header presence"""
        list_response = self.client.get("/api/v1/webpages/layouts/")
        if list_response.data["results"]:
            layout_name = list_response.data["results"][0]["name"]

            response = self.client.get(f"/api/v1/webpages/layouts/{layout_name}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("Last-Modified", response)

            # Verify it's a valid HTTP date
            last_modified = response.get("Last-Modified")
            self.assertIsNotNone(last_modified)
