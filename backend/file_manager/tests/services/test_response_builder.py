"""
Tests for the UploadResponseBuilder class.
"""

import pytest
from rest_framework import status
from rest_framework.response import Response

from ...services import UploadResponseBuilder, UploadResponseData


class TestUploadResponseBuilder:
    """Test cases for UploadResponseBuilder."""

    def test_successful_upload_response(self):
        """Test response for successful uploads."""
        builder = UploadResponseBuilder()
        uploaded_files = [
            {
                "id": "1",
                "original_filename": "test1.jpg",
                "status": "pending_approval"
            }
        ]
        errors = []

        response = builder.build_response(uploaded_files, errors)

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success_count"] == 1
        assert response.data["rejected_count"] == 0
        assert response.data["error_count"] == 0
        assert "errors" not in response.data

    def test_all_rejected_response(self):
        """Test response when all files are rejected."""
        builder = UploadResponseBuilder()
        uploaded_files = []
        errors = [
            {
                "filename": "test1.jpg",
                "error": "File already exists",
                "status": "rejected"
            }
        ]

        response = builder.build_response(uploaded_files, errors)

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success_count"] == 0
        assert response.data["rejected_count"] == 1
        assert response.data["error_count"] == 0
        assert len(response.data["rejected_files"]) == 1

    def test_mixed_success_and_rejection_response(self):
        """Test response with both successful and rejected files."""
        builder = UploadResponseBuilder()
        uploaded_files = [
            {
                "id": "1",
                "original_filename": "test1.jpg",
                "status": "pending_approval"
            }
        ]
        errors = [
            {
                "filename": "test2.jpg",
                "error": "File already exists",
                "status": "rejected"
            }
        ]

        response = builder.build_response(uploaded_files, errors)

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success_count"] == 1
        assert response.data["rejected_count"] == 1
        assert response.data["error_count"] == 0
        assert len(response.data["uploaded_files"]) == 1
        assert len(response.data["rejected_files"]) == 1

    def test_error_response(self):
        """Test response when files have errors."""
        builder = UploadResponseBuilder()
        uploaded_files = []
        errors = [
            {
                "filename": "test1.jpg",
                "error": "Upload failed",
                "status": "error"
            }
        ]

        response = builder.build_response(uploaded_files, errors)

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success_count"] == 0
        assert response.data["rejected_count"] == 0
        assert response.data["error_count"] == 1
        assert len(response.data["errors"]) == 1

    def test_validation_error_response(self):
        """Test response for validation errors."""
        builder = UploadResponseBuilder()
        serializer_errors = {"files": ["This field is required"]}

        response = builder.build_validation_error_response(serializer_errors)

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data == serializer_errors

    def test_namespace_not_found_response(self):
        """Test response for namespace not found."""
        builder = UploadResponseBuilder()
        response = builder.build_namespace_not_found_response("test-namespace")

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Namespace 'test-namespace' not found" in response.data["error"]

    def test_namespace_access_denied_response(self):
        """Test response for namespace access denied."""
        builder = UploadResponseBuilder()
        response = builder.build_namespace_access_denied_response()

        assert isinstance(response, Response)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Access denied" in response.data["error"]

    def test_build_error_response(self):
        """Test building error response dictionary."""
        builder = UploadResponseBuilder()
        error = Exception("Test error")
        error_dict = builder.build_error_response("test.jpg", error)

        assert error_dict["filename"] == "test.jpg"
        assert error_dict["error"] == "Test error"
        assert error_dict["status"] == "error"
