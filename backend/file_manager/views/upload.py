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
        replace_files = serializer.validated_data.get("replace_files", {})

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

                # Check if user has made a decision about this file
                file_action = replace_files.get(uploaded_file.name, {})
                action = (
                    file_action.get("action") if isinstance(file_action, dict) else None
                )

                if action == "replace":
                    # User wants to replace existing file
                    existing_file_id = file_action.get("existing_file_id")
                    if existing_file_id:
                        try:
                            # Delete or archive the existing file
                            existing_file = (
                                MediaFile.objects.with_deleted()
                                .filter(id=existing_file_id)
                                .first()
                            )
                            if existing_file:
                                existing_file.delete(request.user)
                                logger.info(
                                    f"Deleted existing file {existing_file_id} for replacement"
                                )

                            # Also check for pending file with same hash and delete it
                            existing_pending = PendingMediaFile.objects.filter(
                                id=file_action.get("pending_file_id")
                            ).first()
                            if existing_pending:
                                existing_pending.delete()
                                logger.info(
                                    f"Deleted existing pending file for replacement"
                                )
                        except Exception as e:
                            logger.error(f"Error deleting file for replacement: {e}")

                    # Upload the new file (skip duplicate check)
                    upload_result = self.upload_service.upload(
                        uploaded_file,
                        serializer.validated_data.get("folder_path", ""),
                        namespace,
                        request.user,
                    )
                    uploaded_files.extend(upload_result.files)
                    if upload_result.errors:
                        errors.extend(upload_result.errors)
                    continue

                elif action == "keep":
                    # User wants to keep both - upload with unique name (skip duplicate check)
                    upload_result = self.upload_service.upload(
                        uploaded_file,
                        serializer.validated_data.get("folder_path", ""),
                        namespace,
                        request.user,
                    )
                    uploaded_files.extend(upload_result.files)
                    if upload_result.errors:
                        errors.extend(upload_result.errors)
                    continue

                # Normal flow: Check for duplicates
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
