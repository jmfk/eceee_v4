"""
Tests for the media file cleanup system.
"""

import uuid
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.core.management import call_command
from django.contrib.auth.models import User
from django.utils import timezone
from content.models import Namespace
from ..models import MediaFile
from ..tasks import cleanup_deleted_files


class MediaFileCleanupTests(TestCase):
    """Test cases for MediaFile cleanup functionality."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", created_by=self.user
        )

        # Create some test files
        self.create_test_files()

    def create_test_files(self):
        """Create a set of test files with different states."""
        # Active file
        self.active_file = MediaFile.objects.create(
            title="Active File",
            original_filename="active.jpg",
            file_path="test/active.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Recently deleted file
        self.recent_deleted = MediaFile.objects.create(
            title="Recent Deleted",
            original_filename="recent.jpg",
            file_path="test/recent.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.recent_deleted.delete(user=self.user)

        # Old deleted file
        self.old_deleted = MediaFile.objects.create(
            title="Old Deleted",
            original_filename="old.jpg",
            file_path="test/old.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.old_deleted.delete(user=self.user)
        # Manually update deleted_at to be old
        old_date = timezone.now() - timedelta(days=60)
        MediaFile.objects.filter(id=self.old_deleted.id).update(deleted_at=old_date)

        # Old deleted file with references
        self.referenced_deleted = MediaFile.objects.create(
            title="Referenced Deleted",
            original_filename="referenced.jpg",
            file_path="test/referenced.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.referenced_deleted.delete(user=self.user)
        MediaFile.objects.filter(id=self.referenced_deleted.id).update(
            deleted_at=old_date,
            reference_count=1,
            referenced_in={"webpage": [str(uuid.uuid4())]},
        )

    def test_cleanup_command(self):
        """Test the cleanup_deleted_files management command."""
        # Run cleanup with default settings (30 days)
        call_command("cleanup_deleted_files")

        # Check results
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.active_file.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.recent_deleted.id).exists()
        )
        self.assertFalse(
            MediaFile.objects.with_deleted().filter(id=self.old_deleted.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted()
            .filter(id=self.referenced_deleted.id)
            .exists()
        )

    def test_cleanup_command_dry_run(self):
        """Test the cleanup command in dry run mode."""
        # Run cleanup in dry run mode
        call_command("cleanup_deleted_files", dry_run=True)

        # All files should still exist
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.active_file.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.recent_deleted.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.old_deleted.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted()
            .filter(id=self.referenced_deleted.id)
            .exists()
        )

    def test_cleanup_command_custom_days(self):
        """Test the cleanup command with custom retention period."""
        # Run cleanup with 7 days retention
        call_command("cleanup_deleted_files", days=7)

        # Both old and recent deleted files should be removed
        self.assertTrue(
            MediaFile.objects.with_deleted().filter(id=self.active_file.id).exists()
        )
        self.assertFalse(
            MediaFile.objects.with_deleted().filter(id=self.recent_deleted.id).exists()
        )
        self.assertFalse(
            MediaFile.objects.with_deleted().filter(id=self.old_deleted.id).exists()
        )
        self.assertTrue(
            MediaFile.objects.with_deleted()
            .filter(id=self.referenced_deleted.id)
            .exists()
        )

    @patch("file_manager.tasks.call_command")
    def test_cleanup_celery_task(self, mock_call_command):
        """Test the Celery task for cleanup."""
        # Run the Celery task
        cleanup_deleted_files.delay(days=30, batch_size=100)

        # Check that the management command was called with correct args
        mock_call_command.assert_called_once_with(
            "cleanup_deleted_files", days=30, batch_size=100, dry_run=False
        )

    def test_cleanup_batch_processing(self):
        """Test that cleanup processes files in batches."""
        # Create a lot of old deleted files
        old_date = timezone.now() - timedelta(days=60)
        batch_files = []
        for i in range(150):  # Create more than the default batch size
            file = MediaFile.objects.create(
                title=f"Batch File {i}",
                original_filename=f"batch_{i}.jpg",
                file_path=f"test/batch_{i}.jpg",
                file_size=1000,
                content_type="image/jpeg",
                file_type="image",
                file_hash=str(uuid.uuid4()),
                namespace=self.namespace,
                created_by=self.user,
                last_modified_by=self.user,
            )
            file.delete(user=self.user)
            batch_files.append(file.id)

        # Update all files to be old
        MediaFile.objects.filter(id__in=batch_files).update(deleted_at=old_date)

        # Run cleanup with small batch size
        call_command("cleanup_deleted_files", batch_size=50)

        # All batch files should be cleaned up
        remaining_count = (
            MediaFile.objects.with_deleted().filter(id__in=batch_files).count()
        )
        self.assertEqual(remaining_count, 0)
