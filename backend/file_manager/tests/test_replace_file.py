"""
Tests for MediaFile replace_file endpoint and replacement resolution.
"""

import hashlib
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from file_manager.models import MediaFile


class MediaFileReplaceFileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.client.defaults["HTTP_HOST"] = "localhost"

        self.namespace = Namespace.get_default()

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
            created_by=self.user,
            last_modified_by=self.user,
        )

    @patch("file_manager.views.media_file.S3MediaStorage.overwrite_file")
    def test_replace_file_unique_hash_overwrites_in_place(self, mock_overwrite_file):
        new_bytes = b"unique-image-bytes"
        new_hash = hashlib.sha256(new_bytes).hexdigest()

        mock_overwrite_file.return_value = {
            "file_path": self.media_file.file_path,
            "file_size": len(new_bytes),
            "content_type": "image/jpeg",
            "file_hash": new_hash,
            "width": 123,
            "height": 456,
        }

        url = f"/api/v1/media/files/{self.media_file.id}/replace_file/"
        uploaded = SimpleUploadedFile(
            "replacement.jpg", new_bytes, content_type="image/jpeg"
        )
        response = self.client.post(url, {"file": uploaded}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.media_file.refresh_from_db()
        self.assertEqual(self.media_file.file_path, "test-namespace/media/original.jpg")
        self.assertEqual(self.media_file.file_hash, new_hash)
        self.assertIsNone(self.media_file.replaced_by_id)
        mock_overwrite_file.assert_called_once()

    def test_replace_file_hash_conflict_sets_replaced_by(self):
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
            created_by=self.user,
            last_modified_by=self.user,
        )

        url = f"/api/v1/media/files/{self.media_file.id}/replace_file/"
        uploaded = SimpleUploadedFile(
            "replacement.jpg", conflict_bytes, content_type="image/jpeg"
        )

        with patch("file_manager.views.media_file.S3MediaStorage.overwrite_file") as mock_overwrite:
            response = self.client.post(url, {"file": uploaded}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.media_file.refresh_from_db()
        self.assertEqual(self.media_file.replaced_by_id, existing.id)
        mock_overwrite.assert_not_called()


class MediaFileReplacementResolutionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.defaults["HTTP_HOST"] = "localhost"
        self.namespace = Namespace.get_default()

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

