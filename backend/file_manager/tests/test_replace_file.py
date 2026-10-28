"""
Tests for MediaFile replace_file endpoint and replacement resolution.
"""

import hashlib
import io
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from file_manager.models import MediaFile, MediaFileVersion


class MediaFileReplaceFileTests(APITestCase):
    def setUp(self):
        from core.models import Tenant

        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.client.force_authenticate(user=self.user)
        self.client.defaults["HTTP_HOST"] = "localhost"

        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant-replace", created_by=self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
                "tenant": self.tenant,
            },
        )

        self.media_file = MediaFile.objects.create(
            title="Original",
            slug="original",
            original_filename="original.jpg",
            file_path="test-namespace/media/original.jpg",
            file_size=10,
            content_type="image/jpeg",
            file_type="image",
            file_hash="0" * 64,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    @patch("file_manager.views.media_file.S3MediaStorage.upload_file")
    @patch("file_manager.views.media_file.S3MediaStorage.get_public_url")
    def test_replace_file_creates_previous_version(self, mock_public_url, mock_upload_file):
        new_bytes = b"unique-image-bytes"
        new_hash = hashlib.sha256(new_bytes).hexdigest()

        mock_public_url.return_value = "https://storage.test/new.jpg"
        mock_upload_file.return_value = {
            "file_path": "test-namespace/media/new.jpg",
            "file_size": len(new_bytes),
            "content_type": "image/jpeg",
            "file_hash": new_hash,
            "width": 123,
            "height": 456,
        }

        url = f"/api/v1/media/files/{self.media_file.id}/replace_file/"
        uploaded = SimpleUploadedFile("replacement.jpg", new_bytes, content_type="image/jpeg")
        response = self.client.post(url, {"file": uploaded}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.media_file.refresh_from_db()
        self.assertEqual(self.media_file.file_path, "test-namespace/media/new.jpg")
        self.assertEqual(self.media_file.file_hash, new_hash)
        self.assertEqual(self.media_file.version_number, 2)
        self.assertIsNone(self.media_file.replaced_by_id)
        previous = self.media_file.image_versions.get()
        self.assertEqual(previous.file_path, "test-namespace/media/original.jpg")
        mock_upload_file.assert_called_once()

    def test_replace_file_hash_conflict_keeps_separate_identity(self):
        conflict_bytes = b"conflict-bytes"
        conflict_hash = hashlib.sha256(conflict_bytes).hexdigest()

        existing = MediaFile.objects.create(
            title="Existing",
            slug="existing",
            original_filename="existing.jpg",
            file_path="test-namespace/media/existing.jpg",
            file_size=10,
            content_type="image/jpeg",
            file_type="image",
            file_hash=conflict_hash,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        url = f"/api/v1/media/files/{self.media_file.id}/replace_file/"
        uploaded = SimpleUploadedFile("replacement.jpg", conflict_bytes, content_type="image/jpeg")

        with (
            patch(
                "file_manager.views.media_file.S3MediaStorage.upload_file",
                return_value={
                    "file_path": "test-namespace/media/independent.jpg",
                    "file_size": len(conflict_bytes),
                    "content_type": "image/jpeg",
                    "file_hash": conflict_hash,
                },
            ) as mock_upload,
            patch(
                "file_manager.views.media_file.S3MediaStorage.get_public_url",
                return_value="https://storage.test/independent.jpg",
            ),
        ):
            response = self.client.post(url, {"file": uploaded}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.media_file.refresh_from_db()
        self.assertIsNone(self.media_file.replaced_by_id)
        self.assertNotEqual(self.media_file.file_path, existing.file_path)
        mock_upload.assert_called_once()

    @patch("file_manager.views.media_file.S3MediaStorage._open", return_value=io.BytesIO(b"old-image"))
    @patch(
        "file_manager.views.media_file.S3MediaStorage.get_public_url", return_value="https://storage.test/restored.jpg"
    )
    @patch("file_manager.views.media_file.S3MediaStorage.upload_file")
    def test_restore_creates_new_current_version(self, mock_upload, _public_url, _open):
        old = MediaFileVersion.objects.create(
            media_file=self.media_file,
            version_number=1,
            file_path="test-namespace/media/older.jpg",
            original_filename="older.jpg",
            file_size=9,
            content_type="image/jpeg",
            file_hash="1" * 64,
            uploaded_at=timezone.now(),
            superseded_at=timezone.now(),
            uploaded_by=self.user,
        )
        self.media_file.version_number = 2
        self.media_file.save(update_fields=["version_number"])
        mock_upload.return_value = {
            "file_path": "test-namespace/media/restored.jpg",
            "file_size": 9,
            "content_type": "image/jpeg",
            "file_hash": "1" * 64,
        }

        response = self.client.post(
            f"/api/v1/media/files/{self.media_file.id}/restore_version/",
            {"version_id": str(old.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.media_file.refresh_from_db()
        self.assertEqual(self.media_file.version_number, 3)
        self.assertEqual(self.media_file.file_path, "test-namespace/media/restored.jpg")
        self.assertEqual(self.media_file.image_versions.count(), 2)
        mock_upload.assert_called_once()

    def test_replace_file_refetches_after_waiting_for_transfer_lock(self):
        replacement_bytes = b"replacement-that-already-won"
        replacement_hash = hashlib.sha256(replacement_bytes).hexdigest()

        class MutatingLock:
            def __enter__(inner_self):
                MediaFile.objects.filter(pk=self.media_file.pk).update(file_hash=replacement_hash)
                return inner_self

            def __exit__(inner_self, exc_type, exc_value, traceback):
                return False

        uploaded = SimpleUploadedFile("replacement.jpg", replacement_bytes, content_type="image/jpeg")
        url = f"/api/v1/media/files/{self.media_file.id}/replace_file/"
        with (
            patch(
                "object_storage.services.transfer_checkpoints.tenant_transfer_lock",
                return_value=MutatingLock(),
            ),
            patch("file_manager.views.media_file.S3MediaStorage.upload_file") as mock_upload,
        ):
            mock_upload.return_value = {
                "file_path": "test-namespace/media/after-lock.jpg",
                "file_size": len(replacement_bytes),
                "content_type": "image/jpeg",
                "file_hash": replacement_hash,
            }
            response = self.client.post(url, {"file": uploaded}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_upload.assert_called_once()


class MediaFileReplacementResolutionTests(APITestCase):
    def setUp(self):
        from core.models import Tenant

        self.user = User.objects.create_user(username="testuser_res", email="test@example.com", password="testpass123")
        self.client.defaults["HTTP_HOST"] = "localhost"

        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant-res", created_by=self.user)
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
                "tenant": self.tenant,
            },
        )

        self.replacement = MediaFile.objects.create(
            title="Replacement",
            slug="replacement",
            original_filename="replacement.jpg",
            file_path="test-namespace/media/replacement.jpg",
            file_size=10,
            content_type="image/jpeg",
            file_type="image",
            file_hash="1" * 64,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.original = MediaFile.objects.create(
            title="Original",
            slug="original",
            original_filename="original.jpg",
            file_path="test-namespace/media/original.jpg",
            file_size=10,
            content_type="image/jpeg",
            file_type="image",
            file_hash="0" * 64,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            replaced_by=self.replacement,
        )

    @patch("file_manager.views.utils.storage.generate_signed_url")
    def test_uuid_view_redirects_to_replacement(self, mock_get_signed_url):
        mock_get_signed_url.return_value = "https://signed.example/replacement"

        url = f"/api/v1/media/file/{self.original.id}/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://signed.example/replacement")
        self.assertEqual(response["Cache-Control"], "no-store, max-age=0")
