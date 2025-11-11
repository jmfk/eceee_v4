"""
ViewSets for managing media tags and collections.
"""

import os
import zipfile
import tempfile
from django.db import models
from django.db.models import Count
from django.conf import settings
from django.http import HttpResponse, FileResponse
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import logging

from ..models import MediaTag, MediaCollection, MediaFile
from ..serializers import (
    MediaTagSerializer,
    MediaCollectionSerializer,
    MediaFileListSerializer,
    MediaFileDetailSerializer,
)
from ..services import (
    FileUploadService,
    FileValidationService,
    UploadResponseBuilder,
)
from ..storage import storage

logger = logging.getLogger(__name__)


class MediaTagViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media tags."""

    serializer_class = MediaTagSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["created_by"]
    search_fields = ["name", "slug"]
    ordering_fields = ["name", "created_at", "file_count"]
    ordering = ["name"]

    def get_queryset(self):
        """Filter tags by user's accessible namespaces."""
        from content.models import Namespace
        from django.shortcuts import get_object_or_404

        queryset = MediaTag.objects.select_related("namespace", "created_by")

        # Handle namespace filtering by slug only
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            if namespace_param == "default":
                # Handle "default" specially to get the default namespace
                namespace = Namespace.get_default()
            else:
                # Handle other slugs
                namespace = get_object_or_404(Namespace, slug=namespace_param)
            queryset = queryset.filter(namespace=namespace)
        else:
            # Use default namespace if none specified
            default_namespace = Namespace.get_default()
            queryset = queryset.filter(namespace=default_namespace)

        return queryset

    def perform_create(self, serializer):
        """Set created_by when creating tag."""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def files(self, request, pk=None):
        """Get all files using this tag with pagination."""
        tag = self.get_object()

        # Get files with this tag
        files = (
            MediaFile.objects.filter(tags=tag, namespace=tag.namespace)
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags", "collections")
        )

        # Apply user permissions (same logic as MediaFileViewSet)
        user = request.user
        if not user.is_staff:
            from content.models import Namespace

            # Get namespaces the user can access
            accessible_namespaces = Namespace.objects.filter(
                models.Q(created_by=user) | models.Q(is_active=True)
            )
            files = files.filter(namespace__in=accessible_namespaces)

            # Further filter by access level
            from django.db.models import Q

            files = files.filter(
                Q(access_level="public")
                | Q(access_level="members")
                | Q(access_level="private", created_by=user)
            )

        # Apply search if provided
        search = request.query_params.get("search")
        if search:
            files = files.filter(
                models.Q(title__icontains=search)
                | models.Q(description__icontains=search)
                | models.Q(original_filename__icontains=search)
            )

        # Apply ordering
        ordering = request.query_params.get("ordering", "-created_at")
        files = files.order_by(ordering)

        # Paginate
        page = self.paginate_queryset(files)
        if page is not None:
            serializer = MediaFileListSerializer(
                page, many=True, context={"request": request}
            )
            return self.get_paginated_response(serializer.data)

        serializer = MediaFileListSerializer(
            files, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def usage_stats(self, request):
        """Get usage statistics for all tags."""
        queryset = self.get_queryset()

        # Annotate with file count
        queryset = queryset.annotate(file_count=Count("mediafile"))

        # Apply search filter using the filter backends
        for backend in self.filter_backends:
            queryset = backend().filter_queryset(request, queryset, self)

        # Paginate
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def merge_tags(self, request):
        """Merge multiple tags into one target tag."""
        target_tag_id = request.data.get("target_tag_id")
        source_tag_ids = request.data.get("source_tag_ids", [])

        if not target_tag_id:
            return Response(
                {"error": "target_tag_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not source_tag_ids or len(source_tag_ids) == 0:
            return Response(
                {
                    "error": "source_tag_ids is required and must contain at least one tag"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get target tag
        try:
            target_tag = MediaTag.objects.get(id=target_tag_id)
        except MediaTag.DoesNotExist:
            return Response(
                {"error": "Target tag not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get source tags
        source_tags = MediaTag.objects.filter(id__in=source_tag_ids)
        if source_tags.count() != len(source_tag_ids):
            return Response(
                {"error": "One or more source tags not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Ensure all tags are in the same namespace
        namespaces = set(
            [target_tag.namespace_id]
            + list(source_tags.values_list("namespace_id", flat=True))
        )
        if len(namespaces) > 1:
            return Response(
                {"error": "All tags must be in the same namespace"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Transfer all file associations from source tags to target tag
        files_transferred = 0
        for source_tag in source_tags:
            files = MediaFile.objects.filter(tags=source_tag)
            for file in files:
                # Add target tag if not already present
                if not file.tags.filter(id=target_tag.id).exists():
                    file.tags.add(target_tag)
                    files_transferred += 1
                # Remove source tag
                file.tags.remove(source_tag)

        # Delete source tags
        source_tags_count = source_tags.count()
        source_tags.delete()

        return Response(
            {
                "message": f"Successfully merged {source_tags_count} tags into '{target_tag.name}'",
                "target_tag": MediaTagSerializer(target_tag).data,
                "files_transferred": files_transferred,
                "tags_deleted": source_tags_count,
            }
        )

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        """Delete multiple tags at once."""
        tag_ids = request.data.get("tag_ids", [])

        if not tag_ids or len(tag_ids) == 0:
            return Response(
                {"error": "tag_ids is required and must contain at least one tag"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get tags
        tags = MediaTag.objects.filter(id__in=tag_ids)
        if tags.count() != len(tag_ids):
            return Response(
                {"error": "One or more tags not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify user has permission to delete these tags (same namespace check from get_queryset)
        user_tags = self.get_queryset().filter(id__in=tag_ids)
        if user_tags.count() != len(tag_ids):
            return Response(
                {
                    "error": "You don't have permission to delete one or more of these tags"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Remove all file associations and delete tags
        tags_count = tags.count()
        for tag in tags:
            # Remove from all files
            tag.mediafile_set.clear()

        # Delete tags
        tags.delete()

        return Response(
            {
                "message": f"Successfully deleted {tags_count} tags",
                "deleted_count": tags_count,
            }
        )


class MediaCollectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media collections."""

    serializer_class = MediaCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "slug"]
    ordering_fields = ["title", "created_at", "updated_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        """Filter collections by user's accessible namespaces."""
        from content.models import Namespace
        from django.shortcuts import get_object_or_404

        queryset = MediaCollection.objects.select_related(
            "namespace", "created_by", "last_modified_by"
        ).prefetch_related("tags")

        # Handle namespace filtering by slug only
        namespace_slug = self.request.query_params.get("namespace")
        if namespace_slug:
            queryset = queryset.filter(namespace__slug=namespace_slug)
        else:
            # Use default namespace if none specified
            default_namespace = Namespace.get_default()
            queryset = queryset.filter(namespace=default_namespace)
        return queryset

    def create(self, request, *args, **kwargs):
        """Create a new collection with tag validation."""
        # Validate that at least one tag is provided
        tag_ids = request.data.get('tag_ids', [])
        if not tag_ids or len(tag_ids) == 0:
            return Response(
                {
                    "error": "At least one tag is required to create a collection",
                    "detail": "Collections must have tags to accept uploads."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Set user fields when creating collection."""
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        """Set last_modified_by when updating collection."""
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["get"])
    def files(self, request, pk=None):
        """Get files in this collection."""
        collection = self.get_object()

        # Get files in this collection with proper permissions
        files = (
            MediaFile.objects.filter(
                collections=collection, namespace=collection.namespace
            )
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags", "collections")
        )

        # Apply user permissions (same logic as MediaFileViewSet)
        user = request.user
        if not user.is_staff:
            from content.models import Namespace

            # Get namespaces the user can access
            accessible_namespaces = Namespace.objects.filter(
                models.Q(created_by=user) | models.Q(is_active=True)
            )
            files = files.filter(namespace__in=accessible_namespaces)

            # Further filter by access level
            from django.db.models import Q

            files = files.filter(
                Q(access_level="public")
                | Q(access_level="members")
                | Q(access_level="private", created_by=user)
            )

        # Apply search if provided
        search = request.query_params.get("search")
        if search:
            files = files.filter(
                models.Q(title__icontains=search)
                | models.Q(description__icontains=search)
                | models.Q(original_filename__icontains=search)
            )

        # Apply ordering
        ordering = request.query_params.get("ordering", "-created_at")
        files = files.order_by(ordering)

        # Paginate
        page = self.paginate_queryset(files)
        if page is not None:
            serializer = MediaFileListSerializer(
                page, many=True, context={"request": request}
            )
            return self.get_paginated_response(serializer.data)

        serializer = MediaFileListSerializer(
            files, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def add_files(self, request, pk=None):
        """Add files to a collection."""
        collection = self.get_object()
        file_ids = request.data.get("file_ids", [])

        if not file_ids:
            return Response(
                {"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get files that exist and belong to the same namespace
        files = MediaFile.objects.filter(
            id__in=file_ids, namespace=collection.namespace
        )

        if not files.exists():
            return Response(
                {"error": "No valid files found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Add files to collection
        collection.mediafile_set.add(*files)

        return Response(
            {
                "message": f"Added {files.count()} files to collection",
                "added_count": files.count(),
            }
        )

    @action(detail=True, methods=["post"])
    def remove_files(self, request, pk=None):
        """Remove files from a collection."""
        collection = self.get_object()
        file_ids = request.data.get("file_ids", [])

        if not file_ids:
            return Response(
                {"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get files that are in the collection
        files = collection.mediafile_set.filter(id__in=file_ids)

        if not files.exists():
            return Response(
                {"error": "No files found in collection"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Remove files from collection
        collection.mediafile_set.remove(*files)

        return Response(
            {
                "message": f"Removed {files.count()} files from collection",
                "removed_count": files.count(),
            }
        )

    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_to_collection(self, request, pk=None):
        """
        Upload files directly to a collection with auto-approval.
        
        Files uploaded through this endpoint:
        - Are automatically approved (skip pending workflow)
        - Inherit all tags from the collection
        - Are added to the collection
        - Require the collection to have at least one tag
        """
        collection = self.get_object()
        
        # Validate collection has tags
        if not collection.tags.exists():
            return Response(
                {
                    "error": "Collection must have at least one tag before uploading files",
                    "detail": "Please add tags to the collection first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Get uploaded files from request
        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {"error": "No files provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file count (use same limit as regular uploads)
        max_files = getattr(settings, "MEDIA_MAX_FILES_PER_UPLOAD", 50)
        if len(files) > max_files:
            return Response(
                {"error": f"Maximum {max_files} files allowed per upload"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Initialize services
        validation_service = FileValidationService()
        upload_service = FileUploadService()
        
        uploaded_files = []
        errors = []
        
        # Get collection tags for auto-assignment
        collection_tag_ids = list(collection.tags.values_list('id', flat=True))
        
        # Process each file
        for uploaded_file in files:
            try:
                # Validate file
                validation_result = validation_service.validate(
                    uploaded_file,
                    request.user,
                    force_upload=False,
                )
                if not validation_result.is_valid:
                    errors.extend(validation_result.errors)
                    continue
                
                # Upload file to pending (for initial storage and processing)
                upload_result = upload_service.upload(
                    uploaded_file,
                    "",  # No folder path for collection uploads
                    collection.namespace,
                    request.user,
                )
                
                if upload_result.errors:
                    errors.extend(upload_result.errors)
                    continue
                
                # Auto-approve each pending file
                for pending_file in upload_result.files:
                    try:
                        # Create approved MediaFile from pending file
                        media_file = pending_file.approve_and_create_media_file(
                            title=pending_file.ai_suggested_title or pending_file.original_filename,
                            slug=None,  # Auto-generate slug
                            description="",
                            tags=collection_tag_ids,
                            access_level="public",
                        )
                        
                        # Add to collection
                        collection.mediafile_set.add(media_file)
                        
                        uploaded_files.append(media_file)
                        
                    except Exception as e:
                        logger.error(f"Error auto-approving file {pending_file.original_filename}: {e}")
                        errors.append({
                            "filename": pending_file.original_filename,
                            "error": f"Failed to approve file: {str(e)}",
                            "status": "error"
                        })
                
            except Exception as e:
                logger.error(f"Error processing file {uploaded_file.name}: {e}")
                errors.append({
                    "filename": uploaded_file.name,
                    "error": str(e),
                    "status": "error"
                })
        
        # Build response
        response_data = {
            "success": len(uploaded_files) > 0,
            "uploaded_count": len(uploaded_files),
            "error_count": len(errors),
            "message": f"Successfully uploaded {len(uploaded_files)} file(s) to collection",
        }
        
        if uploaded_files:
            # Serialize uploaded files
            serializer = MediaFileDetailSerializer(
                uploaded_files, 
                many=True, 
                context={"request": request}
            )
            response_data["files"] = serializer.data
        
        if errors:
            response_data["errors"] = errors
        
        response_status = status.HTTP_200_OK if len(uploaded_files) > 0 else status.HTTP_400_BAD_REQUEST
        
        return Response(response_data, status=response_status)

    @action(detail=True, methods=["get"])
    def download_zip(self, request, pk=None):
        """
        Download all files in a collection as a ZIP archive.
        
        Creates a temporary ZIP file containing all files in the collection,
        then streams it to the client with proper headers.
        """
        collection = self.get_object()
        
        # Get all files in the collection
        files = MediaFile.objects.filter(
            collections=collection,
            namespace=collection.namespace,
            is_deleted=False
        ).select_related("namespace")
        
        if not files.exists():
            return Response(
                {"error": "Collection has no files to download"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create a temporary file for the ZIP
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        temp_zip_path = temp_zip.name
        temp_zip.close()
        
        try:
            # Create ZIP file
            with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for media_file in files:
                    try:
                        # Get the file from storage
                        file_path = media_file.file_path
                        
                        # Download file content from storage
                        file_content = storage.download_file(file_path)
                        
                        # Use original filename in the ZIP
                        # Add file type subdirectory to organize files
                        archive_name = f"{media_file.file_type}/{media_file.original_filename}"
                        
                        # Write to ZIP
                        zip_file.writestr(archive_name, file_content)
                        
                    except Exception as e:
                        logger.error(f"Error adding file {media_file.id} to ZIP: {e}")
                        # Continue with other files even if one fails
                        continue
            
            # Open the ZIP file for reading
            zip_file_handle = open(temp_zip_path, 'rb')
            
            # Create response with ZIP file
            response = FileResponse(
                zip_file_handle,
                content_type='application/zip'
            )
            
            # Set download filename
            safe_filename = collection.slug or f"collection-{collection.id}"
            response['Content-Disposition'] = f'attachment; filename="{safe_filename}.zip"'
            
            # Clean up temp file after response is sent
            # Note: The temp file will be cleaned up by the OS eventually,
            # but we could use a post-response cleanup mechanism if needed
            
            return response
            
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_zip_path):
                os.unlink(temp_zip_path)
            
            logger.error(f"Error creating ZIP for collection {collection.id}: {e}")
            return Response(
                {"error": f"Failed to create ZIP archive: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
