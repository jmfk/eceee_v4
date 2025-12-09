"""
Views for handling media file uploads with AI analysis and security validation.
"""

import logging
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from ..models import MediaFile, PendingMediaFile, MediaCollection
from ..serializers import MediaUploadSerializer, MediaFileDetailSerializer, PendingMediaFileListSerializer
from ..services import (
    FileUploadService,
    DuplicateFileHandler,
    FileValidationService,
    UploadResponseBuilder,
    NamespaceAccessService,
    ZipExtractionService,
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
        self.zip_service = ZipExtractionService()

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
        
        # Check for ZIP files and extract if enabled
        extract_zip = serializer.validated_data.get("extract_zip", True)
        collection_id = serializer.validated_data.get("collection_id")
        max_zip_size = serializer.validated_data.get("max_zip_size")
        
        zip_files = []
        regular_files = []
        
        for uploaded_file in serializer.validated_data["files"]:
            is_zip = uploaded_file.content_type in [
                "application/zip",
                "application/x-zip-compressed"
            ] or uploaded_file.name.endswith('.zip')
            
            if is_zip and extract_zip:
                zip_files.append(uploaded_file)
            else:
                regular_files.append(uploaded_file)
        
        # Process ZIP files first
        for zip_file in zip_files:
            try:
                # Get collection if specified
                collection = None
                if collection_id:
                    try:
                        collection = MediaCollection.objects.get(
                            id=collection_id,
                            namespace=namespace
                        )
                    except MediaCollection.DoesNotExist:
                        errors.append({
                            "filename": zip_file.name,
                            "error": "Collection not found",
                            "status": "error"
                        })
                        continue
                
                # Create collection slug from ZIP filename if not providing existing collection
                collection_slug = None
                if not collection:
                    import os
                    from django.utils.text import slugify
                    base_name = os.path.splitext(zip_file.name)[0]
                    collection_slug = slugify(base_name)
                
                # Extract ZIP
                extraction_result = self.zip_service.extract_zip(
                    zip_file,
                    namespace,
                    request.user,
                    collection=collection,
                    collection_slug=collection_slug,
                    tags=None,  # Tags from collection will be used if available
                    max_size=max_zip_size
                )
                
                if extraction_result.success:
                    # Serialize MediaFile instances to dicts
                    for media_file in extraction_result.files:
                        if isinstance(media_file, PendingMediaFile):
                            serializer = PendingMediaFileListSerializer(media_file)
                            uploaded_files.append(serializer.data)
                        elif isinstance(media_file, dict):
                            uploaded_files.append(media_file)
                        else:
                            # MediaFile instance - serialize it
                            serializer = MediaFileDetailSerializer(media_file)
                            uploaded_files.append(serializer.data)
                    
                if extraction_result.errors:
                    errors.extend(extraction_result.errors)
                
                # Add warnings as info messages
                for warning in extraction_result.warnings:
                    errors.append({
                        "filename": zip_file.name,
                        "error": warning,
                        "status": "warning"
                    })
                    
            except Exception as e:
                logger.error(f"Error extracting ZIP {zip_file.name}: {e}")
                errors.append({
                    "filename": zip_file.name,
                    "error": f"Failed to extract ZIP: {str(e)}",
                    "status": "error"
                })

        # Process regular files (non-ZIP or extract_zip=False)
        for uploaded_file in regular_files:
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

                            # Also check for pending file with same hash and delete it
                            existing_pending = PendingMediaFile.objects.filter(
                                id=file_action.get("pending_file_id")
                            ).first()
                            if existing_pending:
                                existing_pending.delete()
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
