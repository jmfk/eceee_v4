"""
Tests for Media System API Endpoints
"""

import hashlib
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag, PendingMediaFile
from file_manager.security import get_pending_preview_token
from file_manager.services import DuplicateFileHandler, NamespaceAccessService


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

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
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

    def test_hidden_theme_media_rejects_users_without_designer_access(self):
        theme_namespace = Namespace.get_or_create_theme_media(self.tenant, created_by=self.user)
        theme_media = MediaFile.objects.create(
            title="Restricted theme background",
            slug="restricted-theme-background",
            file_type="image",
            file_path="themes/restricted-background.jpg",
            file_hash="restricted-theme-background-hash",
            file_size=2048,
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=theme_namespace,
            tenant=self.tenant,
            content_type="image/jpeg",
        )
        outsider = User.objects.create_user(username="theme_media_outsider", password="testpass123")
        outsider_token = Token.objects.create(user=outsider)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + outsider_token.key)

        list_response = self.client.get(
            reverse("api:file_manager:mediafile-list"),
            {"namespace": theme_namespace.slug},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        search_response = self.client.get(
            reverse("api:file_manager:media-search"),
            {"namespace": theme_namespace.slug},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        detail_response = self.client.get(
            reverse("api:file_manager:mediafile-detail", kwargs={"pk": theme_media.id}),
        )
        update_response = self.client.patch(
            reverse("api:file_manager:mediafile-detail", kwargs={"pk": theme_media.id}),
            {"title": "Outsider edit"},
            format="json",
        )

        namespace_result = NamespaceAccessService().get_and_validate_namespace(outsider, theme_namespace.slug)

        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(search_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(namespace_result.status_code, status.HTTP_403_FORBIDDEN)

        outsider_bulk_response = self.client.post(
            reverse("api:file_manager:bulk-operations"),
            {"file_ids": [str(theme_media.id)], "operation": "set_access_level", "access_level": "private"},
            format="json",
        )
        theme_media.refresh_from_db()
        self.assertEqual(outsider_bulk_response.status_code, status.HTTP_200_OK)
        self.assertEqual(outsider_bulk_response.data["successful_count"], 0)
        self.assertEqual(theme_media.access_level, "public")

        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)
        allowed_detail = self.client.get(
            reverse("api:file_manager:mediafile-detail", kwargs={"pk": theme_media.id}),
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        allowed_update = self.client.patch(
            reverse("api:file_manager:mediafile-detail", kwargs={"pk": theme_media.id}),
            {"title": "Updated theme background"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(allowed_detail.status_code, status.HTTP_200_OK, allowed_detail.data)
        self.assertEqual(allowed_update.status_code, status.HTTP_200_OK, allowed_update.data)
        self.assertEqual(allowed_update.data["title"], "Updated theme background")

        staff_outsider = User.objects.create_user(username="theme_media_staff_outsider", is_staff=True)
        staff_outsider_token = Token.objects.create(user=staff_outsider)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + staff_outsider_token.key)
        staff_bulk_response = self.client.post(
            reverse("api:file_manager:bulk-operations"),
            {"file_ids": [str(theme_media.id)], "operation": "set_access_level", "access_level": "private"},
            format="json",
        )
        theme_media.refresh_from_db()
        self.assertEqual(staff_bulk_response.data["successful_count"], 0)
        self.assertEqual(theme_media.access_level, "public")

        MediaFile.objects.filter(pk=theme_media.id).update(is_deleted=True)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + outsider_token.key)
        restore_response = self.client.post(
            reverse("api:file_manager:mediafile-restore", kwargs={"pk": theme_media.id}),
        )
        references_response = self.client.get(
            reverse("api:file_manager:mediafile-references", kwargs={"pk": theme_media.id}),
        )
        self.client.credentials(HTTP_AUTHORIZATION="Token " + staff_outsider_token.key)
        force_delete_response = self.client.post(
            reverse("api:file_manager:mediafile-force-delete", kwargs={"pk": theme_media.id}),
        )

        self.assertIn(
            restore_response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )
        self.assertEqual(references_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(force_delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(MediaFile.objects.with_deleted().filter(pk=theme_media.id, is_deleted=True).exists())

        pending_theme_media = PendingMediaFile.objects.create(
            original_filename="pending-theme.jpg",
            file_path="themes/pending-theme.jpg",
            file_size=1024,
            content_type="image/jpeg",
            file_hash="pending-theme-media-hash",
            file_type="image",
            namespace=theme_namespace,
            expires_at=timezone.now() + timedelta(hours=1),
            uploaded_by=self.user,
        )
        pending_list = self.client.get(
            reverse("api:file_manager:pendingmediafile-list"),
            {"namespace": theme_namespace.slug},
        )
        pending_detail = self.client.get(
            reverse("api:file_manager:pendingmediafile-detail", kwargs={"pk": pending_theme_media.id}),
        )
        pending_approve = self.client.post(
            reverse("api:file_manager:pendingmediafile-approve", kwargs={"pk": pending_theme_media.id}),
            {"title": "Unauthorized approval"},
            format="json",
        )
        pending_bulk_reject = self.client.post(
            reverse("api:file_manager:pendingmediafile-bulk-reject"),
            {"file_ids": [str(pending_theme_media.id)]},
            format="json",
        )
        unsigned_preview = self.client.get(
            reverse("api:file_manager:pendingmediafile-preview", kwargs={"pk": pending_theme_media.id})
        )
        preview_token = get_pending_preview_token(pending_theme_media)
        with patch("file_manager.views.pending_media.storage.get_file_content", return_value=b"theme-image"):
            signed_preview = self.client.get(
                reverse("api:file_manager:pendingmediafile-preview", kwargs={"pk": pending_theme_media.id}),
                {"preview_token": preview_token},
            )

        self.assertEqual(pending_list.status_code, status.HTTP_200_OK)
        self.assertEqual(pending_list.data["results"], [])
        self.assertEqual(pending_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(pending_approve.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(pending_bulk_reject.data["summary"]["errors"], 1)
        self.assertEqual(unsigned_preview.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(signed_preview.status_code, status.HTTP_200_OK)
        self.assertEqual(signed_preview.content, b"theme-image")
        pending_theme_media.refresh_from_db()
        self.assertEqual(pending_theme_media.status, "pending")

    def test_upload_replace_target_cannot_cross_namespace(self):
        theme_namespace = Namespace.get_or_create_theme_media(self.tenant, created_by=self.user)
        theme_media = MediaFile.objects.create(
            title="Protected theme image",
            slug="protected-theme-image",
            original_filename="protected.jpg",
            file_type="image",
            file_path="themes/protected.jpg",
            file_hash="protected-theme-image-hash",
            file_size=2048,
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=theme_namespace,
            tenant=self.tenant,
            content_type="image/jpeg",
        )
        upload = SimpleUploadedFile("replacement.jpg", b"replacement", content_type="image/jpeg")

        with patch("file_manager.views.upload.FileValidationService.validate") as validate:
            validate.return_value.is_valid = True
            validate.return_value.errors = []
            response = self.client.post(
                reverse("api:file_manager:media-upload"),
                {
                    "files": [upload],
                    "namespace": self.namespace.slug,
                    "replace_files": (
                        '{"replacement.jpg":{"action":"replace","existing_file_id":"' + str(theme_media.id) + '"}}'
                    ),
                },
                format="multipart",
            )

        theme_media.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertFalse(theme_media.is_deleted)
        self.assertTrue(any("Replacement target not found" in item["error"] for item in response.data["errors"]))

    def test_duplicate_hash_cannot_move_media_between_namespaces(self):
        theme_namespace = Namespace.get_or_create_theme_media(self.tenant, created_by=self.user)
        duplicate_content = b"shared-image-content"
        theme_media = MediaFile.objects.create(
            title="Protected duplicate",
            slug="protected-duplicate",
            original_filename="protected.jpg",
            file_type="image",
            file_path="themes/protected-duplicate.jpg",
            file_hash=hashlib.sha256(duplicate_content).hexdigest(),
            file_size=len(duplicate_content),
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=theme_namespace,
            tenant=self.tenant,
            content_type="image/jpeg",
        )
        upload = SimpleUploadedFile("duplicate.jpg", duplicate_content, content_type="image/jpeg")

        result = DuplicateFileHandler().check_duplicates(upload, self.namespace, self.user)

        theme_media.refresh_from_db()
        self.assertTrue(result.has_duplicates)
        self.assertEqual(result.errors[0]["reason"], "duplicate_other_namespace")
        self.assertNotIn("existing_file", result.errors[0])
        self.assertEqual(theme_media.namespace, theme_namespace)
        self.assertFalse(PendingMediaFile.objects.filter(namespace=self.namespace).exists())

    def test_hidden_theme_media_tags_and_collections_reject_outsiders(self):
        theme_namespace = Namespace.get_or_create_theme_media(self.tenant, created_by=self.user)
        target_tag = MediaTag.objects.create(
            name="Theme target",
            slug="theme-target",
            namespace=theme_namespace,
            created_by=self.user,
        )
        source_tag = MediaTag.objects.create(
            name="Theme source",
            slug="theme-source",
            namespace=theme_namespace,
            created_by=self.user,
        )
        collection = MediaCollection.objects.create(
            title="Theme collection",
            slug="theme-collection",
            namespace=theme_namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        collection.tags.add(target_tag)

        outsider = User.objects.create_user(username="theme_taxonomy_outsider", password="testpass123")
        self.client.force_authenticate(user=outsider)

        tag_list = self.client.get(
            reverse("api:file_manager:mediatag-list"),
            {"namespace": theme_namespace.slug},
        )
        tag_detail = self.client.get(
            reverse("api:file_manager:mediatag-detail", kwargs={"pk": target_tag.id}),
            {"namespace": theme_namespace.slug},
        )
        tag_create = self.client.post(
            reverse("api:file_manager:mediatag-list"),
            {"name": "Outsider tag", "slug": "outsider-tag", "namespace": theme_namespace.slug},
            format="json",
        )
        tag_merge = self.client.post(
            f'{reverse("api:file_manager:mediatag-merge-tags")}?namespace={theme_namespace.slug}',
            {"target_tag_id": str(target_tag.id), "source_tag_ids": [str(source_tag.id)]},
            format="json",
        )
        collection_list = self.client.get(
            reverse("api:file_manager:mediacollection-list"),
            {"namespace": theme_namespace.slug},
        )
        collection_detail = self.client.get(
            reverse("api:file_manager:mediacollection-detail", kwargs={"pk": collection.id}),
        )
        collection_create = self.client.post(
            reverse("api:file_manager:mediacollection-list"),
            {
                "title": "Outsider collection",
                "namespace": theme_namespace.slug,
                "tag_ids": [str(target_tag.id)],
            },
            format="json",
        )

        self.assertEqual(tag_list.status_code, status.HTTP_200_OK)
        self.assertEqual(tag_list.data["results"], [])
        self.assertEqual(tag_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(tag_create.status_code, status.HTTP_403_FORBIDDEN, tag_create.data)
        self.assertEqual(tag_merge.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(collection_list.status_code, status.HTTP_200_OK)
        self.assertEqual(collection_list.data["results"], [])
        self.assertEqual(collection_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(collection_create.status_code, status.HTTP_403_FORBIDDEN)

        self.assertTrue(MediaTag.objects.filter(pk=source_tag.id).exists())
        self.assertFalse(MediaTag.objects.filter(name="Outsider tag").exists())
        self.assertFalse(MediaCollection.objects.filter(title="Outsider collection").exists())

        self.client.force_authenticate(user=self.user)
        allowed_tag = self.client.post(
            reverse("api:file_manager:mediatag-list"),
            {"name": "Allowed theme tag", "slug": "allowed-theme-tag", "namespace": theme_namespace.slug},
            format="json",
        )
        allowed_collection = self.client.post(
            reverse("api:file_manager:mediacollection-list"),
            {
                "title": "Allowed theme collection",
                "namespace": theme_namespace.slug,
                "tag_ids": [str(target_tag.id)],
            },
            format="json",
        )

        self.assertEqual(allowed_tag.status_code, status.HTTP_201_CREATED)
        self.assertEqual(allowed_collection.status_code, status.HTTP_201_CREATED)

    def test_theme_media_namespace_name_handles_max_length_tenant_identifier(self):
        long_tenant = Tenant.objects.create(
            name="Long tenant",
            identifier="t" * 100,
            created_by=self.user,
        )

        namespace = Namespace.get_or_create_theme_media(long_tenant, created_by=self.user)

        self.assertLessEqual(len(namespace.name), 100)
        self.assertEqual(namespace.kind, Namespace.KIND_THEME_MEDIA)
        self.assertTrue(namespace.name.endswith(long_tenant.id.hex))

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
