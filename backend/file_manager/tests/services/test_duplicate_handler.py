"""
Tests for the DuplicateFileHandler class.
"""

import pytest
from unittest.mock import Mock, patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.utils import timezone

from ...services import DuplicateFileHandler
from ...models import MediaFile, PendingMediaFile
from content.models import Namespace

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="testpass")


@pytest.fixture
def namespace():
    return Namespace.objects.create(
        name="Test Namespace", slug="test-namespace", is_active=True
    )


@pytest.fixture
def upload_file():
    return SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")


@pytest.fixture
def existing_media_file(user, namespace):
    return MediaFile.objects.create(
        title="Existing File",
        slug="existing-file",
        file_path="uploads/existing.jpg",
        file_hash="testhash123",
        file_size=100,
        content_type="image/jpeg",
        file_type="image",
        width=800,
        height=600,
        namespace=namespace,
        uploaded_by=user,
    )


@pytest.fixture
def existing_pending_file(user, namespace):
    return PendingMediaFile.objects.create(
        original_filename="pending.jpg",
        file_path="uploads/pending.jpg",
        file_hash="pendinghash123",
        file_size=200,
        content_type="image/jpeg",
        file_type="image",
        width=1024,
        height=768,
        namespace=namespace,
        uploaded_by=user,
        expires_at=timezone.now() + timezone.timedelta(hours=24),
        status="pending",
    )


@pytest.mark.django_db
class TestDuplicateFileHandler:
    """Test cases for DuplicateFileHandler."""

    def test_no_duplicates(self, user, namespace, upload_file):
        """Test when no duplicates exist."""
        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "uniquehash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert not result.has_duplicates
            assert not result.errors
            assert not result.pending_files
            assert result.existing_file is None
            assert result.existing_pending is None

    def test_existing_active_file(
        self, user, namespace, upload_file, existing_media_file
    ):
        """Test when file exists and is active."""
        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "testhash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert result.has_duplicates
            assert len(result.errors) == 1
            assert result.errors[0]["reason"] == "duplicate"
            assert result.existing_file == existing_media_file

            # Verify pending file was created for tag merging
            pending_file = PendingMediaFile.objects.first()
            assert pending_file is not None
            assert pending_file.file_hash == "testhash123"

    def test_existing_deleted_file(
        self, user, namespace, upload_file, existing_media_file
    ):
        """Test when file exists but is deleted."""
        # Delete the existing file
        existing_media_file.soft_delete(user)

        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "testhash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert result.has_duplicates
            assert not result.errors
            assert len(result.pending_files) == 1
            assert result.existing_file == existing_media_file

            # Verify file was restored
            existing_media_file.refresh_from_db()
            assert not existing_media_file.is_deleted

            # Verify pending file was created for re-approval
            pending_file = PendingMediaFile.objects.first()
            assert pending_file is not None
            assert pending_file.file_hash == "testhash123"

    def test_existing_pending_file_update(
        self, user, namespace, upload_file, existing_pending_file
    ):
        """Test updating an existing pending file."""
        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "pendinghash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert result.has_duplicates
            assert len(result.errors) == 1
            assert result.errors[0]["reason"] == "duplicate_pending"
            assert not result.pending_files
            assert result.existing_pending == existing_pending_file

            # Verify pending file was updated
            existing_pending_file.refresh_from_db()
            assert existing_pending_file.original_filename == upload_file.name

    def test_multiple_pending_files_same_hash(self, user, namespace, upload_file):
        """Test handling multiple pending files with same hash."""
        # Create two pending files with same hash
        hash_value = "samehash123"
        for i in range(2):
            PendingMediaFile.objects.create(
                original_filename=f"pending{i}.jpg",
                file_path=f"uploads/pending{i}.jpg",
                file_hash=hash_value,
                file_size=100,
                content_type="image/jpeg",
                file_type="image",
                namespace=namespace,
                uploaded_by=user,
                expires_at=timezone.now() + timezone.timedelta(hours=24),
                status="pending",
            )

        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = hash_value

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert result.has_duplicates
            assert len(result.errors) == 1
            assert result.errors[0]["reason"] == "duplicate_pending"

            # Should update the first pending file found
            assert PendingMediaFile.objects.count() == 2
            updated_file = PendingMediaFile.objects.filter(
                original_filename=upload_file.name
            ).first()
            assert updated_file is not None

    def test_pending_file_different_namespace(
        self, user, namespace, upload_file, existing_pending_file
    ):
        """Test handling pending file in different namespace."""
        # Create new namespace
        other_namespace = Namespace.objects.create(
            name="Other Namespace", slug="other-namespace", is_active=True
        )

        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "pendinghash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, other_namespace, user)

            assert result.has_duplicates
            assert len(result.errors) == 1
            assert result.errors[0]["reason"] == "duplicate_pending"

            # Should create new pending file in other namespace
            assert PendingMediaFile.objects.filter(namespace=other_namespace).exists()

    def test_error_handling(self, user, namespace, upload_file):
        """Test handling of errors during duplicate check."""
        with patch("hashlib.sha256") as mock_hash:
            mock_hash.side_effect = Exception("Hash error")

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert result.has_duplicates  # Treated as duplicate for safety
            assert len(result.errors) == 1
            assert (
                "error occurred while checking for duplicates"
                in result.errors[0]["error"]
            )
            assert "Hash error" in result.errors[0]["technical_details"]
            assert not result.pending_files

    def test_user_friendly_error_messages(
        self, user, namespace, upload_file, existing_media_file
    ):
        """Test user-friendly error messages."""
        with patch("hashlib.sha256") as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "testhash123"

            handler = DuplicateFileHandler()
            result = handler.check_duplicates(upload_file, namespace, user)

            assert "already exists in the system" in result.errors[0]["error"]
            assert "new tags" in result.errors[0]["error"]
            assert "media browser" in result.errors[0]["error"]
