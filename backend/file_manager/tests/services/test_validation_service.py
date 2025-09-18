"""
Tests for the FileValidationService class.
"""

import pytest
from unittest.mock import Mock, patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model

from ...services import FileValidationService
from ...security import FileUploadValidator

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="testpass")


@pytest.fixture
def valid_file():
    return SimpleUploadedFile(
        "test.jpg",
        b"file_content",
        content_type="image/jpeg"
    )


@pytest.fixture
def mock_validator():
    with patch("file_manager.security.FileUploadValidator") as mock:
        mock.validate_file.return_value = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "metadata": {
                "width": 800,
                "height": 600,
                "format": "JPEG",
            }
        }
        mock._extract_safe_metadata.return_value = {
            "width": 800,
            "height": 600,
            "format": "JPEG",
        }
        yield mock


@pytest.mark.django_db
class TestFileValidationService:
    """Test cases for FileValidationService."""

    def test_successful_validation(self, user, valid_file, mock_validator):
        """Test successful file validation."""
        service = FileValidationService()
        result = service.validate(valid_file, user)

        assert result.is_valid
        assert not result.errors
        assert not result.warnings
        assert result.metadata == {
            "width": 800,
            "height": 600,
            "format": "JPEG",
        }

    def test_validation_failure(self, user, valid_file, mock_validator):
        """Test handling of validation failures."""
        mock_validator.validate_file.return_value = {
            "is_valid": False,
            "errors": ["Invalid file format"],
            "warnings": [],
            "metadata": {}
        }

        service = FileValidationService()
        result = service.validate(valid_file, user)

        assert not result.is_valid
        assert len(result.errors) == 1
        assert "Invalid file format" in result.errors[0]["error"]
        assert not result.warnings
        assert not result.metadata

    def test_validation_with_warnings(self, user, valid_file, mock_validator):
        """Test validation with warnings."""
        mock_validator.validate_file.return_value = {
            "is_valid": True,
            "errors": [],
            "warnings": ["Large file size"],
            "metadata": {
                "width": 800,
                "height": 600,
                "format": "JPEG",
            }
        }

        service = FileValidationService()
        result = service.validate(valid_file, user)

        assert result.is_valid
        assert not result.errors
        assert len(result.warnings) == 1
        assert "Large file size" in result.warnings
        assert result.metadata

    def test_force_upload(self, user, valid_file, mock_validator):
        """Test force upload bypassing validation."""
        service = FileValidationService()
        result = service.validate(valid_file, user, force_upload=True)

        assert result.is_valid
        assert not result.errors
        assert len(result.warnings) == 1
        assert "Security validation bypassed" in result.warnings[0]
        assert result.metadata

        # Verify validator wasn't called
        mock_validator.validate_file.assert_not_called()

    def test_validation_error(self, user, valid_file, mock_validator):
        """Test handling of validation errors."""
        mock_validator.validate_file.side_effect = Exception("Validation error")

        service = FileValidationService()
        result = service.validate(valid_file, user)

        assert not result.is_valid
        assert len(result.errors) == 1
        assert "Validation error" in result.errors[0]["error"]
        assert not result.warnings
        assert not result.metadata

    def test_content_type_validation(self):
        """Test content type validation."""
        service = FileValidationService()

        # Test with default allowed types
        assert service.validate_content_type("image/jpeg")
        assert service.validate_content_type("application/pdf")
        assert not service.validate_content_type("application/x-malware")

        # Test with custom allowed types
        allowed_types = ["image/png", "image/gif"]
        assert service.validate_content_type("image/png", allowed_types)
        assert not service.validate_content_type("image/jpeg", allowed_types)

    def test_file_size_validation(self):
        """Test file size validation."""
        service = FileValidationService()

        # Test with default max size (50MB)
        assert service.validate_file_size(1024 * 1024)  # 1MB
        assert not service.validate_file_size(100 * 1024 * 1024)  # 100MB

        # Test with custom max size
        max_size = 5 * 1024 * 1024  # 5MB
        assert service.validate_file_size(1024 * 1024, max_size)  # 1MB
        assert not service.validate_file_size(10 * 1024 * 1024, max_size)  # 10MB

    def test_content_type_categorization(self):
        """Test content type categorization."""
        service = FileValidationService()

        assert service.get_content_type_category("image/jpeg") == "image"
        assert service.get_content_type_category("video/mp4") == "video"
        assert service.get_content_type_category("audio/mpeg") == "audio"
        assert service.get_content_type_category("application/pdf") == "document"
        assert service.get_content_type_category("text/plain") == "other"
