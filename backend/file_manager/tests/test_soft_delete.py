"""
Tests for soft delete functionality in the file manager.
"""

import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from content.models import Namespace
from ..models import MediaFile


class MediaFileSoftDeleteTests(TestCase):
    """Test cases for MediaFile soft delete functionality."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.staff_user = User.objects.create_user(
            username="staffuser", password="testpass", is_staff=True
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", created_by=self.user
        )
        self.file = MediaFile.objects.create(
            title="Test File",
            original_filename="test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.client.force_authenticate(user=self.user)

    def test_soft_delete(self):
        """Test that soft delete works correctly."""
        # Try to delete the file
        response = self.client.delete(f"/api/v1/media/files/{self.file.id}/")
        self.assertEqual(response.status_code, 204)

        # Check that the file is soft deleted
        file = MediaFile.objects.with_deleted().get(id=self.file.id)
        self.assertTrue(file.is_deleted)
        self.assertIsNotNone(file.deleted_at)
        self.assertEqual(file.deleted_by, self.user)

        # Check that the file doesn't appear in normal queries
        self.assertFalse(MediaFile.objects.filter(id=self.file.id).exists())

    def test_restore(self):
        """Test that file restoration works correctly."""
        # First soft delete the file
        self.file.delete(user=self.user)

        # Try to restore the file
        response = self.client.post(f"/api/v1/media/files/{self.file.id}/restore/")
        self.assertEqual(response.status_code, 200)

        # Check that the file is restored
        file = MediaFile.objects.get(id=self.file.id)
        self.assertFalse(file.is_deleted)
        self.assertIsNone(file.deleted_at)
        self.assertIsNone(file.deleted_by)

    def test_force_delete_staff_only(self):
        """Test that only staff users can force delete files."""
        # Regular user can't force delete
        response = self.client.post(f"/api/v1/media/files/{self.file.id}/force_delete/")
        self.assertEqual(response.status_code, 403)

        # Staff user can force delete
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(f"/api/v1/media/files/{self.file.id}/force_delete/")
        self.assertEqual(response.status_code, 204)

        # File should be completely gone
        self.assertFalse(
            MediaFile.objects.with_deleted().filter(id=self.file.id).exists()
        )

    def test_prevent_delete_with_references(self):
        """Test that files with references can't be deleted."""
        # Add a reference
        self.file.add_reference("webpage", str(uuid.uuid4()))

        # Try to delete
        response = self.client.delete(f"/api/v1/media/files/{self.file.id}/")
        self.assertEqual(response.status_code, 400)

        # File should still exist
        self.assertTrue(MediaFile.objects.filter(id=self.file.id).exists())

    def test_show_deleted_filter(self):
        """Test that the show_deleted filter works correctly."""
        # Create another file and soft delete it
        deleted_file = MediaFile.objects.create(
            title="Deleted File",
            original_filename="deleted.jpg",
            file_path="test/deleted.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        deleted_file.delete(user=self.user)

        # Regular search should not show deleted files
        response = self.client.get("/api/v1/media/files/")
        self.assertEqual(len(response.data["results"]), 1)

        # Search with show_deleted should show both files for staff
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get("/api/v1/media/files/?show_deleted=true")
        self.assertEqual(len(response.data["results"]), 2)
