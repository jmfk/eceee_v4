"""
MediaFileViewSet for managing media files with security controls.
"""

import logging
from django.utils import timezone
from django.db import models
from django.http import Http404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from ..models import MediaFile
from ..serializers import MediaFileListSerializer, MediaFileDetailSerializer
from ..storage import storage, S3MediaStorage
from .pagination import MediaFilePagination

logger = logging.getLogger(__name__)


def _resolve_replaced_media_file(media_file: MediaFile, max_hops: int = 10) -> MediaFile:
    """Follow replaced_by chain to the final MediaFile (with cycle protection)."""
    current = media_file
    seen = set()
    for _ in range(max_hops):
        if not current.replaced_by_id:
            return current
        if current.id in seen:
            return current
        seen.add(current.id)
        current = current.replaced_by
    return current


class MediaFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media files with security controls."""

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["file_type", "access_level", "created_by"]
    search_fields = [
        "title",
        "slug",
        "description",
        "original_filename",
        "ai_extracted_text",
    ]
    ordering_fields = ["title", "created_at", "updated_at", "file_size"]
    ordering = ["-created_at"]
    pagination_class = MediaFilePagination

    def get_permissions(self):
        """Get permissions based on action."""
        from ..security import MediaFilePermission

        return [MediaFilePermission()]

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore a soft-deleted file."""
        instance = self.get_object()

        if not instance.is_deleted:
            return Response(
                {"error": "File is not deleted"}, status=status.HTTP_400_BAD_REQUEST
            )

        success = instance.restore(request.user)
        if success:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        else:
            return Response(
                {"error": "Failed to restore file"}, status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["post"])
    def force_delete(self, request, pk=None):
        """Permanently delete a file, bypassing reference checks."""
        if not request.user.is_staff:
            return Response(
                {"error": "Only staff users can force delete files"},
                status=status.HTTP_403_FORBIDDEN,
            )

        instance = self.get_object()
        instance.delete(user=request.user, force=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def references(self, request, pk=None):
        """Get all references to this file."""
        instance = self.get_object()
        return Response(
            {
                "reference_count": instance.reference_count,
                "last_referenced": instance.last_referenced,
                "references": instance.get_references(),
            }
        )

    def get_queryset(self):
        """
        Filter queryset based on user permissions and namespace access.

        Supports filtering by:
        - namespace: Filter by namespace slug
        - tag_names: Filter by tag names (AND logic for multiple tags)
        - collection: Exclude files already in this collection (shows potential additions)
        - file_type: Filter by file type (image, video, audio, document, etc.)
        - text_search: Search across title, description, filename, and AI text
        - show_deleted: Include soft-deleted files (staff only)
        """
        from ..security import SecurityAuditLogger

        user = self.request.user

        # Get base queryset (respecting soft deletes)
        queryset = MediaFile.objects.all()

        # Handle soft deletes
        show_deleted = (
            self.request.query_params.get("show_deleted", "").lower() == "true"
        )
        if show_deleted and user.is_staff:
            queryset = MediaFile.objects.with_deleted()
        elif show_deleted:
            return MediaFile.objects.none()  # Non-staff users can't see deleted files

        # Staff users see all files
        if user.is_staff:
            queryset = MediaFile.objects.select_related(
                "namespace", "created_by", "last_modified_by"
            ).prefetch_related("tags", "collections")
        else:
            # Regular users only see files from accessible namespaces
            from content.models import Namespace

            # Get namespaces the user can access
            accessible_namespaces = Namespace.objects.filter(
                models.Q(created_by=user) | models.Q(is_active=True)
            )

            queryset = (
                MediaFile.objects.filter(namespace__in=accessible_namespaces)
                .select_related("namespace", "created_by", "last_modified_by")
                .prefetch_related("tags", "collections")
            )

            # Further filter by access level
            from django.db.models import Q

            queryset = queryset.filter(
                Q(access_level="public")
                | Q(access_level="members")
                | Q(access_level="private", created_by=user)
            )

        # Filter by namespace if provided (slug only)
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            from content.models import Namespace

            try:
                if namespace_param == "default":
                    namespace = Namespace.get_default()
                else:
                    namespace = Namespace.objects.get(slug=namespace_param)
                queryset = queryset.filter(namespace=namespace)
            except Namespace.DoesNotExist:
                queryset = queryset.none()

        # Filter by tags if provided (Django-style repeated parameters)
        tag_names = self.request.query_params.getlist("tag_names")
        if tag_names:
            # Filter files that have ALL specified tags (AND logic)
            for tag_name in tag_names:
                queryset = queryset.filter(tags__name=tag_name)
            # Remove duplicates that might occur from multiple tag joins
            queryset = queryset.distinct()

        # Filter by collection if provided - EXCLUDE files already in the collection
        # This shows potential files that can be added to the collection
        collection_param = self.request.query_params.get("collection")
        if collection_param:
            try:
                # Exclude files that are already in this collection
                queryset = queryset.exclude(collections__id=collection_param)
            except (ValueError, TypeError):
                pass

        # Filter by file type if provided (supports multiple types)
        file_types = self.request.query_params.getlist("file_types")
        if not file_types:
            # Fallback to single file_type for backward compatibility
            file_type = self.request.query_params.get("file_type")
            if file_type:
                file_types = [file_type]

        if file_types:
            queryset = queryset.filter(file_type__in=file_types)

        # Filter by MIME types if provided
        mime_types = self.request.query_params.getlist("mime_types")
        if mime_types:
            queryset = queryset.filter(content_type__in=mime_types)

        # Text search across multiple fields including tags
        text_search = self.request.query_params.get("text_search")
        if text_search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(title__icontains=text_search)
                | Q(description__icontains=text_search)
                | Q(original_filename__icontains=text_search)
                | Q(ai_extracted_text__icontains=text_search)
                | Q(tags__name__icontains=text_search)
            ).distinct()

        return queryset

    def perform_create(self, serializer):
        """Set user and perform security logging on create."""
        from ..security import SecurityAuditLogger

        media_file = serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

        SecurityAuditLogger.log_file_upload(
            self.request.user,
            {
                "filename": media_file.original_filename,
                "size": media_file.file_size,
                "id": str(media_file.id),
            },
            success=True,
        )

    def perform_update(self, serializer):
        """Update last_modified_by on update."""
        serializer.save(last_modified_by=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """Log file access on retrieve."""
        from ..security import SecurityAuditLogger

        instance = self.get_object()
        SecurityAuditLogger.log_file_access(request.user, instance, "view")

        # Update last accessed timestamp
        instance.last_accessed = timezone.now()
        instance.save(update_fields=["last_accessed"])

        return super().retrieve(request, *args, **kwargs)

    def get_serializer_class(self):
        """Use different serializers for list vs detail views."""
        if self.action == "list":
            return MediaFileListSerializer
        return MediaFileDetailSerializer

    def perform_destroy(self, instance):
        """Handle file deletion with soft delete and security logging."""
        from ..security import SecurityAuditLogger

        success = instance.delete(user=self.request.user)

        if not success:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {
                    "error": "Cannot delete file that is referenced in content",
                    "reference_count": instance.reference_count,
                    "references": instance.get_references(),
                }
            )

        SecurityAuditLogger.log_file_deletion(
            self.request.user,
            {
                "filename": instance.original_filename,
                "id": str(instance.id),
                "soft_delete": True,
            },
        )

        # Log the deletion for security audit
        SecurityAuditLogger.log_file_deletion(
            user=self.request.user,
            file_obj=instance,
            context={"single_file_deletion": True},
        )

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Download file with access tracking."""
        media_file = _resolve_replaced_media_file(self.get_object())

        # Update access tracking
        media_file.download_count += 1
        media_file.last_accessed = timezone.now()
        media_file.save(update_fields=["download_count", "last_accessed"])

        # Get signed URL for secure access
        signed_url = storage.generate_signed_url(media_file.file_path)

        if signed_url:
            # Redirect to signed URL
            from django.shortcuts import redirect

            return redirect(signed_url)
        else:
            # Fallback to public URL
            public_url = storage.get_public_url(media_file.file_path)
            return redirect(public_url)

    @action(detail=True, methods=["post"])
    def replace_file(self, request, pk=None):
        """Replace the file in storage while preserving all metadata."""
        from ..security import SecurityAuditLogger
        from django.db import transaction
        import hashlib

        media_file = self.get_object()

        # Check if file is provided
        if "file" not in request.FILES:
            return Response(
                {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES["file"]

        # Validate file size (100MB max)
        max_size = 100 * 1024 * 1024  # 100MB
        if uploaded_file.size > max_size:
            return Response(
                {"error": f"File too large. Maximum size is {max_size / (1024 * 1024)}MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file type (basic check)
        allowed_types = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "video/mp4",
            "video/webm",
            "audio/mpeg",
            "audio/wav",
        ]
        if uploaded_file.content_type not in allowed_types:
            return Response(
                {
                    "error": f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Compute hash up-front (avoids uploading something we can't store)
            uploaded_file.seek(0)
            file_bytes = uploaded_file.read()
            uploaded_file.seek(0)
            new_file_hash = hashlib.sha256(file_bytes).hexdigest()

            # Scenario 1: Same content as current - no-op (optionally overwrite anyway)
            if new_file_hash == media_file.file_hash:
                logger.info(
                    f"Replacement file has same hash as current file {media_file.id}, no changes needed"
                )
                serializer = self.get_serializer(media_file)
                return Response(serializer.data, status=status.HTTP_200_OK)

            # Scenario 2: Hash matches a different active file -> link replacement (keep uniqueness)
            existing_active = (
                MediaFile.objects.filter(file_hash=new_file_hash)
                .exclude(id=media_file.id)
                .first()
            )

            if existing_active:
                with transaction.atomic():
                    media_file.replaced_by = existing_active
                    media_file.last_modified_by = request.user
                    media_file.save(update_fields=["replaced_by", "last_modified_by", "updated_at"])

                serializer = self.get_serializer(media_file)
                return Response(serializer.data, status=status.HTTP_200_OK)

            # Scenario 3: Unique hash -> overwrite object in-place at current key
            s3_storage = S3MediaStorage()
            upload_result = s3_storage.overwrite_file(media_file.file_path, uploaded_file)

            with transaction.atomic():
                media_file.file_size = upload_result["file_size"]
                media_file.content_type = upload_result["content_type"]
                media_file.file_hash = upload_result["file_hash"]
                media_file.width = upload_result.get("width")
                media_file.height = upload_result.get("height")
                media_file.original_filename = uploaded_file.name
                media_file.last_modified_by = request.user
                media_file.replaced_by = None
                media_file.save()

            # Log the file replacement
            SecurityAuditLogger.log_file_upload(
                request.user,
                {
                    "filename": uploaded_file.name,
                    "size": uploaded_file.size,
                    "id": str(media_file.id),
                    "action": "replace",
                    "file_path": media_file.file_path,
                },
                success=True,
            )

            # Return updated media file
            serializer = self.get_serializer(media_file)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to replace file: {e}")
            return Response(
                {"error": f"Failed to replace file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def add_tags(self, request, pk=None):
        """Add tags to a media file. Creates tags if they don't exist."""
        from ..serializers import convert_tag_names_to_ids
        from ..models import MediaTag

        media_file = self.get_object()
        tag_names = request.data.get("tag_names", [])

        if not tag_names:
            return Response(
                {"error": "tag_names is required and must not be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Convert tag names to IDs, creating new tags as needed
            tag_ids = convert_tag_names_to_ids(
                tag_names, media_file.namespace, request.user
            )

            # Get existing tag IDs
            existing_tag_ids = set(str(tag.id) for tag in media_file.tags.all())

            # Add only new tags
            new_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
            if new_tag_ids:
                new_tags = MediaTag.objects.filter(id__in=new_tag_ids)
                media_file.tags.add(*new_tags)

            # Return updated media file
            serializer = self.get_serializer(media_file)
            return Response(
                {
                    "message": f"Added {len(new_tag_ids)} new tag(s) to media file",
                    "media_file": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Failed to add tags: {e}")
            return Response(
                {"error": f"Failed to add tags: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def remove_tags(self, request, pk=None):
        """Remove tags from a media file."""
        from ..models import MediaTag

        media_file = self.get_object()
        tag_ids = request.data.get("tag_ids", [])

        if not tag_ids:
            return Response(
                {"error": "tag_ids is required and must not be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Get tags to remove (only those that belong to this file's namespace)
            tags_to_remove = MediaTag.objects.filter(
                id__in=tag_ids, namespace=media_file.namespace
            )

            # Remove tags from media file
            media_file.tags.remove(*tags_to_remove)

            # Return updated media file
            serializer = self.get_serializer(media_file)
            return Response(
                {
                    "message": f"Removed {tags_to_remove.count()} tag(s) from media file",
                    "media_file": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Failed to remove tags: {e}")
            return Response(
                {"error": f"Failed to remove tags: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
