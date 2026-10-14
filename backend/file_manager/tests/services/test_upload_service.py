"""
Tests for the FileUploadService class.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant
from file_manager.models import PendingMediaFile
from file_manager.services import FileUploadService

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="testpass")


@pytest.fixture
def namespace():
    namespace_user = User.objects.create_user(username="namespace-user", password="testpass")
    tenant = Tenant.objects.create(name="Namespace Tenant", identifier="namespace-tenant", created_by=namespace_user)
    return Namespace.objects.create(
        name="Test Namespace", slug="test-namespace", is_active=True, created_by=namespace_user, tenant=tenant
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

    def test_successful_upload(self, user, test_namespace, upload_file, mock_storage, mock_ai_service):
        """Test successful file upload with all components working."""
        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", test_namespace, user)

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

    def test_upload_with_storage_error(self, user, test_namespace, upload_file, mock_storage):
        """Test handling of storage service errors."""
        mock_storage.upload_file.side_effect = Exception("Storage error")

        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", test_namespace, user)

        assert len(result.files) == 0
        assert len(result.errors) == 1
        assert "Storage error" in result.errors[0]["error"]

    def test_upload_with_ai_error(self, user, test_namespace, upload_file, mock_storage, mock_ai_service):
        """Test handling of AI service errors."""
        mock_ai_service.analyze_media_file.side_effect = Exception("AI error")

        service = FileUploadService()
        result = service.upload(upload_file, "test_folder", test_namespace, user)

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

    def test_update_existing_pending_file(self, user, test_namespace, upload_file, mock_storage, mock_ai_service):
        """Test updating an existing pending file."""
        # Create initial pending file
        service = FileUploadService()
        service.upload(upload_file, "test_folder", test_namespace, user)

        # Modify mock responses for second upload
        mock_storage.upload_file.return_value["file_size"] = 200
        mock_ai_service.analyze_media_file.return_value["suggested_tags"] = [
            "updated",
            "tags",
        ]

        # Upload same file again (same hash)
        service.upload(upload_file, "updated_folder", test_namespace, user)

        # Verify only one pending file exists but was updated
        assert PendingMediaFile.objects.count() == 1
        pending_file = PendingMediaFile.objects.first()
        assert pending_file.file_size == 200
        assert pending_file.folder_path == "updated_folder"
        assert pending_file.ai_generated_tags == ["updated", "tags"]

    def test_hash_collision_cannot_move_pending_file_between_namespaces(self, user, test_namespace, upload_file):
        other_namespace = Namespace.objects.create(
            name="Other Namespace",
            slug="other-namespace",
            is_active=True,
            created_by=user,
            tenant=test_namespace.tenant,
        )
        existing = PendingMediaFile.objects.create(
            original_filename="existing.jpg",
            file_path="other/existing.jpg",
            file_size=50,
            content_type="image/jpeg",
            file_hash="shared-hash",
            file_type="image",
            namespace=other_namespace,
            folder_path="other",
            uploaded_by=user,
            expires_at=timezone.now() + timedelta(hours=24),
        )
        upload_result = {
            "file_path": "requested/losing-upload.jpg",
            "file_size": 100,
            "content_type": "image/jpeg",
            "file_hash": "shared-hash",
            "width": 800,
            "height": 600,
        }

        service = FileUploadService()
        with (
            patch.object(PendingMediaFile.objects, "create", side_effect=IntegrityError("file_hash uniq")),
            patch("file_manager.services.upload_service.storage.delete") as delete_object,
            pytest.raises(ValueError, match="another media namespace"),
        ):
            service._create_pending_file(
                file=upload_file,
                upload_result=upload_result,
                file_type="image",
                ai_analysis={},
                namespace=test_namespace,
                folder_path="requested",
                user=user,
            )

        existing.refresh_from_db()
        assert existing.namespace == other_namespace
        assert existing.file_path == "other/existing.jpg"
        assert existing.folder_path == "other"
        delete_object.assert_called_once_with("requested/losing-upload.jpg")
