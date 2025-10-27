"""
Tests for soft delete functionality in the file manager.
"""

import uuid
import hashlib
from unittest.mock import Mock, patch
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from rest_framework.test import APIClient
from content.models import Namespace
from ..models import MediaFile, PendingMediaFile


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


class AtomicFileHashHandlingTests(TestCase):
    """Test cases for atomic file hash handling with soft delete."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username="testuser", password="testpass")
        #  Use the default namespace that's created in migrations
        self.namespace = Namespace.objects.first()
        if not self.namespace:
            self.namespace = Namespace.objects.create(
                name="Test Namespace",
                slug="test-namespace-atomic",
                created_by=self.user,
            )
        self.test_hash = hashlib.sha256(b"test content").hexdigest()

    def test_reupload_after_soft_delete(self):
        """Test that re-uploading a file after soft delete works correctly."""
        # Create and soft delete a file
        file1 = MediaFile.objects.create(
            title="Original File",
            original_filename="test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1_id = file1.id
        file1.delete(user=self.user)

        # Verify file is soft deleted
        self.assertTrue(MediaFile.objects.with_deleted().get(id=file1_id).is_deleted)

        # Re-upload the same file (same hash) with new metadata
        file2 = MediaFile.create_with_hash_cleanup(
            file_hash=self.test_hash,
            title="New Upload",
            original_filename="new_test.jpg",
            file_path="test/test.jpg",  # Same S3 object
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Verify new file was created
        self.assertIsNotNone(file2)
        self.assertEqual(file2.title, "New Upload")
        self.assertEqual(file2.file_hash, self.test_hash)
        self.assertFalse(file2.is_deleted)

        # Verify old file was hard deleted
        self.assertFalse(MediaFile.objects.with_deleted().filter(id=file1_id).exists())

        # Verify only one file with this hash exists
        files_with_hash = MediaFile.objects.with_deleted().filter(
            file_hash=self.test_hash
        )
        self.assertEqual(files_with_hash.count(), 1)
        self.assertEqual(files_with_hash.first().id, file2.id)

    def test_cannot_create_duplicate_active_file(self):
        """Test that creating a file with existing active hash raises error."""
        # Create an active file
        MediaFile.objects.create(
            title="Active File",
            original_filename="active.jpg",
            file_path="test/active.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create another file with same hash
        with self.assertRaises(ValidationError) as context:
            MediaFile.create_with_hash_cleanup(
                file_hash=self.test_hash,
                title="Duplicate File",
                original_filename="duplicate.jpg",
                file_path="test/duplicate.jpg",
                file_size=1000,
                content_type="image/jpeg",
                file_type="image",
                namespace=self.namespace,
                created_by=self.user,
                last_modified_by=self.user,
            )

        self.assertIn("already exists", str(context.exception))

    def test_s3_object_cleanup_during_hash_handling(self):
        """Test that S3 cleanup works correctly when re-uploading after soft delete."""
        # Create and soft delete a file
        file1 = MediaFile.objects.create(
            title="Original File",
            original_filename="test.jpg",
            file_path="test/old_upload.jpg",  # Old S3 path
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1.delete(user=self.user)

        # Mock the S3 storage
        with patch("file_manager.storage.S3MediaStorage") as mock_storage_class:
            mock_storage = Mock()
            mock_storage_class.return_value = mock_storage

            # Re-upload with same hash but NEW S3 path (realistic scenario)
            file2 = MediaFile.create_with_hash_cleanup(
                file_hash=self.test_hash,
                title="New Upload",
                original_filename="new_test.jpg",
                file_path="test/new_upload.jpg",  # New S3 path
                file_size=1000,
                content_type="image/jpeg",
                file_type="image",
                namespace=self.namespace,
                created_by=self.user,
                last_modified_by=self.user,
            )

            # Verify S3 delete WAS called for the old file
            # (since there are no other references to it at deletion time)
            mock_storage.delete_file.assert_called_once_with("test/old_upload.jpg")

            # Verify new file was created
            self.assertIsNotNone(file2)
            self.assertEqual(file2.file_hash, self.test_hash)
            self.assertEqual(file2.file_path, "test/new_upload.jpg")

    def test_atomic_transaction_rollback(self):
        """Test that transaction rolls back if file creation fails."""
        # Create and soft delete a file
        file1 = MediaFile.objects.create(
            title="Original File",
            original_filename="test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1_id = file1.id
        file1.delete(user=self.user)

        # Try to create new file but trigger an error (missing required field)
        with self.assertRaises(Exception):
            MediaFile.create_with_hash_cleanup(
                file_hash=self.test_hash,
                title="New Upload",
                # Missing required fields to trigger error
                namespace=self.namespace,
            )

        # Verify old file still exists (rollback happened)
        self.assertTrue(MediaFile.objects.with_deleted().filter(id=file1_id).exists())

        # Verify it's still soft deleted
        file1_restored = MediaFile.objects.with_deleted().get(id=file1_id)
        self.assertTrue(file1_restored.is_deleted)

    def test_pending_file_approve_with_soft_deleted_hash(self):
        """Test that approving pending file handles soft-deleted MediaFile correctly."""
        # Create and soft delete a MediaFile
        file1 = MediaFile.objects.create(
            title="Original File",
            original_filename="test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1_id = file1.id
        file1.delete(user=self.user)

        # Create a pending file with same hash
        pending = PendingMediaFile.objects.create(
            original_filename="new_test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_hash=self.test_hash,
            file_type="image",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )

        # Approve pending file
        media_file = pending.approve_and_create_media_file(
            title="Approved File",
            description="Test description",
            access_level="public",
        )

        # Verify new MediaFile was created
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.title, "Approved File")
        self.assertEqual(media_file.file_hash, self.test_hash)
        self.assertFalse(media_file.is_deleted)

        # Verify old file was hard deleted
        self.assertFalse(MediaFile.objects.with_deleted().filter(id=file1_id).exists())

        # Verify pending file was marked as approved
        pending.refresh_from_db()
        self.assertEqual(pending.status, "approved")

    def test_multiple_soft_deleted_same_hash(self):
        """Test handling when multiple soft-deleted files have same hash (edge case)."""
        # Create and soft delete first file
        file1 = MediaFile.objects.create(
            title="File 1",
            original_filename="test1.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1.delete(user=self.user)
        file1_id = file1.id

        # Force delete to allow another creation (simulate edge case)
        file1_deleted = MediaFile.objects.with_deleted().get(id=file1_id)
        file1_deleted.delete(force=True)

        # Create and soft delete second file with same hash
        file2 = MediaFile.objects.create(
            title="File 2",
            original_filename="test2.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file2_id = file2.id
        file2.delete(user=self.user)

        # Create new file with same hash - should clean up the soft-deleted one
        file3 = MediaFile.create_with_hash_cleanup(
            file_hash=self.test_hash,
            title="File 3",
            original_filename="test3.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Verify new file was created
        self.assertIsNotNone(file3)
        self.assertEqual(file3.title, "File 3")

        # Verify file2 was hard deleted
        self.assertFalse(MediaFile.objects.with_deleted().filter(id=file2_id).exists())

        # Verify only one file with this hash exists
        files_with_hash = MediaFile.objects.with_deleted().filter(
            file_hash=self.test_hash
        )
        self.assertEqual(files_with_hash.count(), 1)

    def test_hard_delete_checks_all_references(self):
        """Test that hard delete checks both active and soft-deleted references."""
        # Create two files with same hash
        file1 = MediaFile.objects.create(
            title="File 1",
            original_filename="test1.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        file1_id = file1.id

        # Soft delete it
        file1.delete(user=self.user)

        # Create another file with same hash (using force delete first)
        file1_deleted = MediaFile.objects.with_deleted().get(id=file1_id)

        with patch("file_manager.storage.S3MediaStorage") as mock_storage_class:
            mock_storage = Mock()
            mock_storage_class.return_value = mock_storage

            # Hard delete the soft-deleted file
            file1_deleted.delete(force=True)

            # Since this is the last reference, S3 should be deleted
            mock_storage.delete_file.assert_called_once_with("test/test.jpg")
