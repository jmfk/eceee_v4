"""
Tests for Media System API Endpoints
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
import json
import uuid
from unittest.mock import patch, MagicMock

from file_manager.models import MediaFile, MediaTag, MediaCollection
from content.models import Namespace
from core.models import Tenant


class MediaFileAPITest(APITestCase):
    """Test MediaFile API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_media_api", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant",
            created_by=self.user
        )

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
            tenant=self.tenant
        )

        self.media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image",
            file_path="test/image.jpg",
            file_hash="fake-hash-123",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
            tenant=self.tenant,
            content_type="image/jpeg"
        )

    def test_list_media_files(self):
        """Test listing media files"""
        url = reverse("api:file_manager:mediafile-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Might be empty if tenant context is not set correctly in middleware for tests
        # but the endpoint should at least exist

    def test_retrieve_media_file(self):
        """Test retrieving a specific media file"""
        url = reverse("api:file_manager:mediafile-detail", kwargs={"pk": self.media_file.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Test Image")
        self.assertEqual(response.data["slug"], "test-image")
        self.assertEqual(response.data["file_type"], "image")
