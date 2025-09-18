"""
Tests for media file reference tracking functionality.
"""

import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from content.models import Namespace
from ..models import MediaFile
from ..utils import (
    extract_media_references,
    update_media_references,
    cleanup_content_references,
)


class MediaFileReferenceTrackingTests(TestCase):
    """Test cases for MediaFile reference tracking functionality."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username="testuser", password="testpass")
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

    def test_extract_media_references(self):
        """Test that media references are correctly extracted from HTML content."""
        # Create HTML content with image references
        html_content = f"""
            <p>Some text</p>
            <img src="/media/{self.file.id}/image.jpg" alt="Test">
            <p>More text</p>
            <img src="/media/{uuid.uuid4()}/nonexistent.jpg" alt="Missing">
        """

        # Extract references
        refs = extract_media_references(html_content)
        self.assertEqual(len(refs), 2)
        self.assertIn(str(self.file.id), refs)

    def test_update_media_references(self):
        """Test that media references are correctly updated when content changes."""
        content_id = str(uuid.uuid4())

        # Initial content with one image
        old_content = f'<img src="/media/{self.file.id}/test.jpg">'

        # New content with a different image
        new_file = MediaFile.objects.create(
            title="New File",
            original_filename="new.jpg",
            file_path="test/new.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        new_content = f'<img src="/media/{new_file.id}/new.jpg">'

        # Update references
        added_refs, removed_refs = update_media_references(
            "webpage", content_id, old_content, new_content
        )

        # Check that references were updated correctly
        self.assertEqual(len(added_refs), 1)
        self.assertEqual(len(removed_refs), 1)
        self.assertEqual(added_refs[0], str(new_file.id))
        self.assertEqual(removed_refs[0], str(self.file.id))

        # Check reference counts
        self.file.refresh_from_db()
        new_file.refresh_from_db()
        self.assertEqual(self.file.reference_count, 0)
        self.assertEqual(new_file.reference_count, 1)

    def test_cleanup_content_references(self):
        """Test that content references are correctly cleaned up."""
        content_id = str(uuid.uuid4())

        # Add some references
        self.file.add_reference("webpage", content_id)
        self.file.add_reference("webpage", str(uuid.uuid4()))

        # Initial reference count should be 2
        self.file.refresh_from_db()
        self.assertEqual(self.file.reference_count, 2)

        # Clean up references for the specific content
        cleanup_content_references("webpage", content_id)

        # Reference count should be reduced by 1
        self.file.refresh_from_db()
        self.assertEqual(self.file.reference_count, 1)

    def test_reference_methods(self):
        """Test the reference management methods on MediaFile model."""
        content_id = str(uuid.uuid4())
        content_type = "webpage"

        # Test adding a reference
        self.file.add_reference(content_type, content_id)
        self.file.refresh_from_db()
        self.assertEqual(self.file.reference_count, 1)
        self.assertIsNotNone(self.file.last_referenced)
        self.assertEqual(self.file.referenced_in, {content_type: [content_id]})

        # Test adding the same reference again (should not increase count)
        self.file.add_reference(content_type, content_id)
        self.file.refresh_from_db()
        self.assertEqual(self.file.reference_count, 1)

        # Test removing a reference
        success = self.file.remove_reference(content_type, content_id)
        self.file.refresh_from_db()
        self.assertTrue(success)
        self.assertEqual(self.file.reference_count, 0)
        self.assertEqual(self.file.referenced_in, {})

        # Test removing a non-existent reference
        success = self.file.remove_reference(content_type, str(uuid.uuid4()))
        self.assertFalse(success)

    def test_reference_deletion_protection(self):
        """Test that files with references cannot be deleted."""
        # Add a reference
        self.file.add_reference("webpage", str(uuid.uuid4()))

        # Try to delete the file
        success = self.file.delete(user=self.user)
        self.assertFalse(success)

        # File should still exist and not be deleted
        self.file.refresh_from_db()
        self.assertFalse(self.file.is_deleted)

        # Remove the reference
        self.file.reference_count = 0
        self.file.referenced_in = {}
        self.file.save()

        # Now deletion should work
        success = self.file.delete(user=self.user)
        self.assertTrue(success)
        self.file.refresh_from_db()
        self.assertTrue(self.file.is_deleted)
