"""
Tests for Media System API Endpoints
"""

import uuid

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaFile, MediaTag


class MediaFileAPITest(APITestCase):
    """Test MediaFile API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_media_api", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant", created_by=self.user)

        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", is_active=True, created_by=self.user, tenant=self.tenant
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
            content_type="image/jpeg",
        )

    def test_list_media_files(self):
        """Test listing media files"""
        url = reverse("api:file_manager:mediafile-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Might be empty if tenant context is not set correctly in middleware for tests
        # but the endpoint should at least exist

    def test_hidden_theme_media_requires_explicit_namespace_filter(self):
        theme_namespace = Namespace.get_or_create_theme_media(self.tenant, created_by=self.user)
        theme_media = MediaFile.objects.create(
            title="Theme background",
            slug="theme-background",
            file_type="image",
            file_path="themes/background.jpg",
            file_hash="theme-background-hash",
            file_size=2048,
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=theme_namespace,
            tenant=self.tenant,
            content_type="image/jpeg",
        )
        url = reverse("api:file_manager:mediafile-list")

        ordinary_response = self.client.get(url, HTTP_X_TENANT_ID=str(self.tenant.id))
        theme_response = self.client.get(
            url,
            {"namespace": theme_namespace.slug},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        search_url = reverse("api:file_manager:media-search")
        ordinary_search = self.client.get(search_url, HTTP_X_TENANT_ID=str(self.tenant.id))
        theme_search = self.client.get(
            search_url,
            {"namespace": theme_namespace.slug},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertNotIn(str(theme_media.id), [str(item["id"]) for item in ordinary_response.data["results"]])
        self.assertEqual([str(item["id"]) for item in theme_response.data["results"]], [str(theme_media.id)])
        self.assertNotIn(str(theme_media.id), [str(item["id"]) for item in ordinary_search.data["results"]])
        self.assertEqual([str(item["id"]) for item in theme_search.data["results"]], [str(theme_media.id)])

    def test_retrieve_media_file(self):
        """Test retrieving a specific media file"""
        url = reverse("api:file_manager:mediafile-detail", kwargs={"pk": self.media_file.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Test Image")
        self.assertEqual(response.data["slug"], "test-image")
        self.assertEqual(response.data["file_type"], "image")

    def test_list_stays_in_tenant_and_can_require_tags(self):
        tag = MediaTag.objects.create(
            name="Designer",
            slug="designer",
            namespace=self.namespace,
            created_by=self.user,
        )
        self.media_file.tags.add(tag)
        MediaFile.objects.create(
            title="Untagged image",
            slug="untagged-image",
            file_type="image",
            file_path="test/untagged.jpg",
            file_hash="untagged-hash",
            file_size=1024,
            file_url="https://example.com/untagged.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
            tenant=self.tenant,
            content_type="image/jpeg",
        )
        other_tenant = Tenant.objects.create(
            name="Other Tenant",
            identifier="other-test-tenant",
            created_by=self.user,
        )
        other_namespace = Namespace.objects.create(
            name="Other Namespace",
            slug="other-test-namespace",
            is_active=True,
            created_by=self.user,
            tenant=other_tenant,
        )
        foreign_media = MediaFile.objects.create(
            title="Foreign tagged image",
            slug="foreign-tagged-image",
            file_type="image",
            file_path="other/foreign.jpg",
            file_hash="foreign-hash",
            file_size=1024,
            file_url="https://example.com/foreign.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=other_namespace,
            tenant=other_tenant,
            content_type="image/jpeg",
        )
        foreign_tag = MediaTag.objects.create(
            name="Foreign Designer",
            slug="foreign-designer",
            namespace=other_namespace,
            created_by=self.user,
        )
        foreign_media.tags.add(foreign_tag)

        response = self.client.get(
            reverse("api:file_manager:mediafile-list"),
            {"has_tags": "true"},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([str(item["id"]) for item in response.data["results"]], [str(self.media_file.id)])

        search_response = self.client.get(
            reverse("api:file_manager:media-search"),
            {"has_tags": "true"},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [str(item["id"]) for item in search_response.data["results"]],
            [str(self.media_file.id)],
        )


class MediaCollectionAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_collection_api", email="collection@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_missing_collection_files_returns_not_found(self):
        url = reverse(
            "api:file_manager:mediacollection-files",
            kwargs={"pk": uuid.uuid4()},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
