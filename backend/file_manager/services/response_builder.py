"""
Service for building consistent API responses for file upload operations.
"""

from dataclasses import dataclass
from typing import List, Dict, Any
from rest_framework import status
from rest_framework.response import Response


@dataclass
class UploadResponseData:
    """Data class to hold components of an upload response."""

    uploaded_files: List[dict]
    rejected_files: List[dict]
    errors: List[dict]
    success_count: int
    rejected_count: int
    error_count: int


class UploadResponseBuilder:
    """Service class to build consistent API responses for file uploads."""

    def build_response(
        self, uploaded_files: List[dict], errors: List[dict]
    ) -> Response:
        """
        Build a response object for a file upload operation.

        Args:
            uploaded_files: List of successfully uploaded files
            errors: List of errors encountered during upload

        Returns:
            Response object with appropriate status code and formatted data
        """
        # Separate rejected files from other errors
        rejected_files = [
            error for error in errors if error.get("status") == "rejected"
        ]
        other_errors = [error for error in errors if error.get("status") != "rejected"]

        response_data = UploadResponseData(
            uploaded_files=uploaded_files,
            rejected_files=rejected_files,
            errors=other_errors if other_errors else [],
            success_count=len(uploaded_files),
            rejected_count=len(rejected_files),
            error_count=len(other_errors),
        )

        return self._create_response(response_data)

    def _create_response(self, data: UploadResponseData) -> Response:
        """
        Create a Response object with appropriate status code.

        Args:
            data: UploadResponseData containing response components

        Returns:
            Response object with status code based on operation results
        """
        response_dict = {
            "uploaded_files": data.uploaded_files,
            "rejected_files": data.rejected_files,
            "success_count": data.success_count,
            "rejected_count": data.rejected_count,
            "error_count": data.error_count,
        }

        if data.errors:
            response_dict["errors"] = data.errors

        # Determine appropriate status code
        if data.success_count > 0:
            # Some files were successfully uploaded
            return Response(response_dict, status=status.HTTP_201_CREATED)
        elif data.rejected_count > 0 and data.error_count == 0:
            # All files were rejected due to duplicates (not an error)
            return Response(response_dict, status=status.HTTP_200_OK)
        else:
            # All files failed with errors
            return Response(response_dict, status=status.HTTP_400_BAD_REQUEST)

    def build_validation_error_response(
        self, serializer_errors: Dict[str, Any]
    ) -> Response:
        """
        Build a response for validation errors from the serializer.

        Args:
            serializer_errors: Dictionary of validation errors

        Returns:
            Response object with validation errors
        """
        return Response(serializer_errors, status=status.HTTP_400_BAD_REQUEST)

    def build_namespace_not_found_response(self, namespace_slug: str) -> Response:
        """
        Build a response for namespace not found error.

        Args:
            namespace_slug: The slug of the namespace that wasn't found

        Returns:
            Response object with not found error
        """
        return Response(
            {"error": f"Namespace '{namespace_slug}' not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    def build_namespace_access_denied_response(self) -> Response:
        """
        Build a response for namespace access denied error.

        Returns:
            Response object with access denied error
        """
        return Response(
            {"error": "Access denied to specified namespace"},
            status=status.HTTP_403_FORBIDDEN,
        )

    def build_error_response(self, file_name: str, error: Exception) -> dict:
        """
        Build an error entry for a file upload error.

        Args:
            file_name: Name of the file that encountered an error
            error: The exception that occurred

        Returns:
            Dictionary containing error details
        """
        return {
            "filename": file_name,
            "error": str(error),
            "status": "error",
        }
