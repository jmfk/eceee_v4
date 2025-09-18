"""
Tests for the FileUploadService class.
"""

import pytest
from unittest.mock import Mock, patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.utils import timezone

from ...services import FileUploadService
from ...models import PendingMediaFile
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
def mock_storage():
    with patch("file_manager.services.upload_service.storage") as mock:
        mock.upload_file.return_value = {
            "file_path": "uploads/test.jpg",
            "file_size": 100,
            "content_type": "image/jpeg",
            "file_hash": "testhash123",
            "width": 800,
            "height": 600,
        }
        yield mock


@pytest.fixture
def mock_ai_service():
    with patch("file_manager.services.upload_service.ai_service") as mock:
        mock.analyze_media_file.return_value = {
            "suggested_tags": ["test", "image"],
            "suggested_title": "Test Image",
            "confidence_score": 0.95,
            "extracted_text": "Sample text",
        }
        yield mock


@pytest.mark.django_db
class TestFileUploadService:
    """Test cases for FileUploadService."""

    def test_successful_upload(
        self, user, namespace, upload_file, mock_storage, mock_ai_service
    ):
        """Test successful file upload with all components working."""
        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", namespace, user)

        assert len(result.files) == 1
        assert result.errors == []
        assert result.file_path == "uploads/test.jpg"
        assert result.file_hash == "testhash123"
        assert not result.existing_file

        # Verify PendingMediaFile was created
        pending_file = PendingMediaFile.objects.first()
        assert pending_file is not None
        assert pending_file.original_filename == "test.jpg"
        assert pending_file.file_type == "image"
        assert pending_file.uploaded_by == user

    def test_upload_with_storage_error(
        self, user, namespace, upload_file, mock_storage
    ):
        """Test handling of storage service errors."""
        mock_storage.upload_file.side_effect = Exception("Storage error")

        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", namespace, user)

        assert len(result.files) == 0
        assert len(result.errors) == 1
        assert "Storage error" in result.errors[0]["error"]

    def test_upload_with_ai_error(
        self, user, namespace, upload_file, mock_storage, mock_ai_service
    ):
        """Test handling of AI service errors."""
        mock_ai_service.analyze_media_file.side_effect = Exception("AI error")

        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", namespace, user)

        # Upload should still succeed even if AI analysis fails
        assert len(result.files) == 1
        assert len(result.errors) == 0

        # Verify PendingMediaFile was created with empty AI fields
        pending_file = PendingMediaFile.objects.first()
        assert pending_file is not None
        assert pending_file.ai_generated_tags == []
        assert pending_file.ai_suggested_title == ""

    def test_determine_file_type(self):
        """Test file type determination from content types."""
        service = FileUploadService()

        assert service._determine_file_type("image/jpeg") == "image"
        assert service._determine_file_type("video/mp4") == "video"
        assert service._determine_file_type("audio/mpeg") == "audio"
        assert service._determine_file_type("application/pdf") == "document"
        assert service._determine_file_type("text/plain") == "other"

    def test_update_existing_pending_file(
        self, user, namespace, upload_file, mock_storage, mock_ai_service
    ):
        """Test updating an existing pending file."""
        # Create initial pending file
        service = FileUploadService()
        first_result = service.upload(upload_file, "test_folder", namespace, user)

        # Modify mock responses for second upload
        mock_storage.upload_file.return_value["file_size"] = 200
        mock_ai_service.analyze_media_file.return_value["suggested_tags"] = [
            "updated",
            "tags",
        ]

        # Upload same file again (same hash)
        second_result = service.upload(upload_file, "updated_folder", namespace, user)

        # Verify only one pending file exists but was updated
        assert PendingMediaFile.objects.count() == 1
        pending_file = PendingMediaFile.objects.first()
        assert pending_file.file_size == 200
        assert pending_file.folder_path == "updated_folder"
        assert pending_file.ai_generated_tags == ["updated", "tags"]
