"""
Views for handling media file uploads with AI analysis and security validation.
"""

import logging
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from ..models import MediaFile, PendingMediaFile
from ..serializers import MediaUploadSerializer
from ..services import (
    FileUploadService,
    DuplicateFileHandler,
    FileValidationService,
    UploadResponseBuilder,
    NamespaceAccessService,
)

logger = logging.getLogger(__name__)


class MediaUploadView(APIView):
    """Handle file uploads with AI analysis and security validation."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.upload_service = FileUploadService()
        self.duplicate_handler = DuplicateFileHandler()
        self.validation_service = FileValidationService()
        self.response_builder = UploadResponseBuilder()
        self.namespace_service = NamespaceAccessService()

    def post(self, request):
        """
        Upload multiple files with comprehensive security validation.

        This endpoint handles file uploads with:
        - Security validation and AI analysis
        - Duplicate detection
        - Namespace access control
        - Proper error handling and response formatting
        """
        # Validate request data
        serializer = MediaUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return self.response_builder.build_validation_error_response(
                serializer.errors
            )

        # Get and validate namespace access
        namespace = self.namespace_service.get_and_validate_namespace(
            request.user, serializer.validated_data["namespace"]
        )
        if isinstance(namespace, Response):
            return namespace

        uploaded_files = []
        errors = []

        # Process each file
        for uploaded_file in serializer.validated_data["files"]:
            try:
                # Validate file
                validation_result = self.validation_service.validate(
                    uploaded_file,
                    request.user,
                    force_upload=serializer.validated_data.get("force_upload", False),
                )
                if not validation_result.is_valid:
                    errors.extend(validation_result.errors)
                    continue

                # Check for duplicates
                duplicate_result = self.duplicate_handler.check_duplicates(
                    uploaded_file, namespace, request.user
                )
                if duplicate_result.has_duplicates:
                    errors.extend(duplicate_result.errors)
                    uploaded_files.extend(duplicate_result.pending_files)
                    continue

                # Upload file
                upload_result = self.upload_service.upload(
                    uploaded_file,
                    serializer.validated_data.get("folder_path", ""),
                    namespace,
                    request.user,
                )
                uploaded_files.extend(upload_result.files)
                if upload_result.errors:
                    errors.extend(upload_result.errors)
            except Exception as e:
                logger.error(f"Error processing file {uploaded_file.name}: {e}")
                errors.append(
                    self.response_builder.build_error_response(uploaded_file.name, e)
                )

        # Build and return response
        return self.response_builder.build_response(uploaded_files, errors)
