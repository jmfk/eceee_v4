"""
MediaFileViewSet for managing media files with security controls.
"""

import logging
import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from core.roles import is_tenant_admin

from ..models import MediaFile, MediaFileVersion
from ..serializers import MediaFileDetailSerializer, MediaFileListSerializer
from ..storage import S3MediaStorage, storage
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


def _store_image_version(media_file, uploaded_file, user):
    """Upload first, then atomically move the logical image to the new object."""
    s3_storage = S3MediaStorage()
    folder_path = media_file.file_path.rsplit("/", 1)[0] if "/" in media_file.file_path else "uploads"
    upload_result = s3_storage.upload_file(uploaded_file, folder_path)
    try:
        with transaction.atomic():
            media_file = MediaFile.objects.select_for_update().get(pk=media_file.pk, tenant_id=media_file.tenant_id)
            now = timezone.now()
            MediaFileVersion.objects.create(
                media_file=media_file,
                version_number=media_file.version_number,
                file_path=media_file.file_path,
                original_filename=media_file.original_filename,
                file_size=media_file.file_size,
                content_type=media_file.content_type,
                file_hash=media_file.file_hash,
                width=media_file.width,
                height=media_file.height,
                uploaded_at=media_file.version_uploaded_at or media_file.created_at,
                uploaded_by=media_file.uploaded_by or media_file.created_by,
                superseded_at=now,
            )
            media_file.file_path = upload_result["file_path"]
            media_file.file_url = s3_storage.get_public_url(media_file.file_path)
            media_file.file_size = upload_result["file_size"]
            media_file.content_type = upload_result["content_type"]
            media_file.file_hash = upload_result["file_hash"]
            media_file.width = upload_result.get("width")
            media_file.height = upload_result.get("height")
            media_file.original_filename = uploaded_file.name
            media_file.uploaded_by = user
            media_file.last_modified_by = user
            media_file.replaced_by = None
            media_file.version_number += 1
            media_file.version_uploaded_at = now
            media_file.save()
            transaction.on_commit(lambda: _safe_invalidate_tenant_theme_css(media_file.tenant_id))
    except Exception:
        s3_storage.delete(upload_result["file_path"])
        raise
    return media_file


def _invalidate_tenant_theme_css(tenant_id):
    """Theme CSS URLs and cached bodies may contain an older media source URL."""
    from webpages.models import PageTheme
    from webpages.services import ThemeCSSGenerator

    theme_ids = list(PageTheme.objects.filter(tenant_id=tenant_id).values_list("id", flat=True))
    PageTheme.objects.filter(id__in=theme_ids).update(updated_at=timezone.now())
    generator = ThemeCSSGenerator()
    for theme_id in theme_ids:
        generator.invalidate_cache(theme_id)


def _safe_invalidate_tenant_theme_css(tenant_id):
    try:
        _invalidate_tenant_theme_css(tenant_id)
    except Exception:
        logger.exception("Could not invalidate theme CSS after image replacement for tenant %s", tenant_id)


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

    def _can_modify(self, request, media_file):
        return media_file.created_by_id == request.user.id or is_tenant_admin(request.user, media_file.tenant)

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        media_file = self.get_object()
        if media_file.file_type != "image":
            return Response({"error": "Only images have versions"}, status=status.HTTP_400_BAD_REQUEST)
        versions = [
            {
                "id": str(version.id),
                "version_number": version.version_number,
                "original_filename": version.original_filename,
                "file_size": version.file_size,
                "content_type": version.content_type,
                "width": version.width,
                "height": version.height,
                "uploaded_at": version.uploaded_at,
                "uploaded_by": version.uploaded_by_id,
                "superseded_at": version.superseded_at,
                "preview_url": storage.generate_signed_url(version.file_path),
                "is_current": False,
            }
            for version in media_file.image_versions.select_related("uploaded_by")
        ]
        versions.insert(
            0,
            {
                "id": None,
                "version_number": media_file.version_number,
                "original_filename": media_file.original_filename,
                "file_size": media_file.file_size,
                "content_type": media_file.content_type,
                "width": media_file.width,
                "height": media_file.height,
                "uploaded_at": media_file.version_uploaded_at or media_file.created_at,
                "uploaded_by": media_file.uploaded_by_id or media_file.created_by_id,
                "superseded_at": None,
                "preview_url": storage.generate_signed_url(media_file.file_path),
                "is_current": True,
            },
        )
        return Response({"protected_from_cleanup": media_file.protected_from_cleanup, "versions": versions})

    @action(detail=True, methods=["post"])
    def protect_versions(self, request, pk=None):
        media_file = self.get_object()
        if not is_tenant_admin(request.user, media_file.tenant):
            return Response(status=status.HTTP_403_FORBIDDEN)
        protected = request.data.get("protected_from_cleanup")
        if not isinstance(protected, bool):
            return Response({"error": "protected_from_cleanup must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)
        from core.models import Tenant

        with transaction.atomic():
            Tenant.objects.select_for_update().get(pk=media_file.tenant_id)
            MediaFile.objects.filter(pk=media_file.pk).update(protected_from_cleanup=protected)
        return Response({"protected_from_cleanup": protected})

    @action(detail=True, methods=["post"])
    def restore_version(self, request, pk=None):
        media_file = self.get_object()
        if not self._can_modify(request, media_file):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            version_id = uuid.UUID(str(request.data.get("version_id")))
        except (TypeError, ValueError, AttributeError):
            return Response({"error": "Invalid image version"}, status=status.HTTP_400_BAD_REQUEST)
        version = media_file.image_versions.filter(pk=version_id).first()
        if not version:
            return Response({"error": "Image version not found"}, status=status.HTTP_404_NOT_FOUND)
        from object_storage.services.transfer_checkpoints import tenant_transfer_lock

        with tenant_transfer_lock(media_file.tenant_id):
            version = media_file.image_versions.filter(pk=version_id).first()
            if not version:
                return Response({"error": "Image version no longer exists"}, status=status.HTTP_404_NOT_FOUND)
            with S3MediaStorage()._open(version.file_path) as source:
                upload = SimpleUploadedFile(version.original_filename, source.read(), content_type=version.content_type)
            media_file = _store_image_version(media_file, upload, request.user)
        return Response(self.get_serializer(media_file).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore a soft-deleted file."""
        # Use with_deleted() to find the file even if it's soft-deleted
        # This is necessary because get_object() uses get_queryset() which might filter them out
        try:
            instance = MediaFile.objects.with_deleted().get(pk=pk)
        except MediaFile.DoesNotExist:
            raise Http404

        tenant = getattr(request, "tenant", None)
        if tenant is not None and instance.tenant_id != tenant.pk:
            raise Http404
        if instance.created_by_id != request.user.id and not is_tenant_admin(request.user, instance.tenant):
            raise Http404
        self.check_object_permissions(request, instance)

        if not instance.is_deleted:
            return Response({"error": "File is not deleted"}, status=status.HTTP_400_BAD_REQUEST)

        success = instance.restore(request.user)
        if success:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        else:
            return Response({"error": "Failed to restore file"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def force_delete(self, request, pk=None):
        """Retain the legacy route without allowing permanent CMS deletion."""
        try:
            instance = MediaFile.objects.with_deleted().get(pk=pk)
        except MediaFile.DoesNotExist:
            raise Http404

        tenant = getattr(request, "tenant", None)
        if tenant is not None and instance.tenant_id != tenant.pk:
            raise Http404

        from ..security import user_can_access_namespace

        if instance.namespace.is_hidden and not user_can_access_namespace(request.user, instance.namespace):
            raise Http404

        if not is_tenant_admin(request.user, tenant):
            return Response(
                {"error": "Workspace administration is required to force delete files"},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {"error": "Permanent deletion through the CMS API is disabled."},
            status=status.HTTP_410_GONE,
        )

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
        - show_deleted: Include soft-deleted files (workspace admins or the uploader)
        """
        user = self.request.user

        # Handle soft deletes
        show_deleted = self.request.query_params.get("show_deleted", "").lower() == "true"
        if show_deleted and is_tenant_admin(user, getattr(self.request, "tenant", None)):
            queryset = MediaFile.objects.with_deleted()
        elif show_deleted:
            queryset = MediaFile.objects.with_deleted().filter(created_by=user)
        else:
            queryset = MediaFile.objects.all()
        if show_deleted and self.request.query_params.get("deleted_only", "").lower() == "true":
            queryset = queryset.filter(is_deleted=True)

        tenant = getattr(self.request, "tenant", None)
        from ..security import filter_media_files_for_user

        namespace_param = self.request.query_params.get("namespace")
        include_theme_media = False
        filter_tenant = tenant
        if namespace_param:
            from content.models import Namespace

            from ..security import user_can_access_namespace

            theme_namespace = Namespace.objects.filter(
                slug=namespace_param,
                tenant=tenant,
                is_hidden=True,
            ).first()
            include_theme_media = bool(theme_namespace and user_can_access_namespace(user, theme_namespace))
        elif self.kwargs.get(self.lookup_field):
            from content.models import Namespace

            from ..security import user_can_access_namespace

            theme_media = (
                queryset.filter(
                    pk=self.kwargs[self.lookup_field],
                    namespace__is_hidden=True,
                )
                .select_related("tenant")
                .first()
            )
            if theme_media and (tenant is None or theme_media.tenant_id == tenant.pk):
                include_theme_media = user_can_access_namespace(user, theme_media.namespace)
                if include_theme_media:
                    filter_tenant = theme_media.tenant

        queryset = (
            filter_media_files_for_user(
                queryset,
                user,
                tenant=filter_tenant,
                include_theme_media=include_theme_media,
            )
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags", "collections")
        )

        # Filter by namespace if provided (slug only)
        if namespace_param:
            from content.models import Namespace

            try:
                if namespace_param == "default":
                    namespace = Namespace.get_default(tenant=tenant)
                else:
                    namespaces = Namespace.objects.all()
                    if tenant is not None:
                        namespaces = namespaces.filter(tenant=tenant)
                    namespace = namespaces.get(slug=namespace_param)
                queryset = queryset.filter(namespace=namespace)
            except Namespace.DoesNotExist:
                queryset = queryset.none()

        from taxonomy.projections import media_term_query

        # Filter by tags if provided (Django-style repeated parameters)
        tag_names = self.request.query_params.getlist("tag_names")
        if tag_names:
            # Filter files that have ALL specified tags (AND logic)
            for tag_name in tag_names:
                queryset = queryset.filter(media_term_query(tenant, tag_name, exact=True))
            # Remove duplicates that might occur from multiple tag joins
            queryset = queryset.distinct()

        if self.request.query_params.get("has_tags", "").lower() == "true":
            queryset = queryset.filter(tags__isnull=False).distinct()

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
                | media_term_query(tenant, text_search)
            ).distinct()

        from taxonomy.services import requested_classifications

        return requested_classifications(self.request, queryset, "classification_links__tag_id")

    def perform_create(self, serializer):
        """Set user and perform security logging on create."""
        from ..security import SecurityAuditLogger

        # Get tenant from request (set by middleware)
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Tenant is required. Provide X-Tenant-ID header.")

        media_file = serializer.save(
            created_by=self.request.user,
            last_modified_by=self.request.user,
            tenant=tenant,
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
                    "error": "Cannot delete a referenced or cleanup-protected file",
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
        """Store an image replacement at a new key and retain its previous bytes."""
        from ..security import SecurityAuditLogger

        media_file = self.get_object()
        if not self._can_modify(request, media_file):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Check if file is provided
        if "file" not in request.FILES:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

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
                {"error": f"Invalid file type. Allowed types: {', '.join(allowed_types)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from object_storage.services.transfer_checkpoints import tenant_transfer_lock

        transfer_lock = tenant_transfer_lock(media_file.tenant_id)
        transfer_lock.__enter__()
        try:
            # The request may have waited behind an import/restore or another
            # replacement. Never make hash or storage decisions from the stale
            # instance fetched before acquiring the tenant barrier.
            media_file = MediaFile.objects.get(pk=media_file.pk, tenant_id=media_file.tenant_id)

            if media_file.file_type != "image" or not uploaded_file.content_type.startswith("image/"):
                return Response({"error": "Image versions require an image file"}, status=status.HTTP_400_BAD_REQUEST)
            media_file = _store_image_version(media_file, uploaded_file, request.user)

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
        finally:
            transfer_lock.__exit__(None, None, None)

    def _clear_imgproxy_cache(self, source_url: str):
        """
        Clear Django cache entries for imgproxy URLs matching the source URL.

        Args:
            source_url: The source URL to clear cache entries for
        """
        import hashlib

        from django.core.cache import cache

        try:
            # Try to clear cache entries using pattern matching (Redis backend)
            # Cache keys are in format: imgproxy_url:{md5_hash}
            # We need to find all keys that contain this source_url in their hash

            # Try delete_pattern if available (Redis cache backend)
            try:
                # Generate pattern to match cache keys for this source URL
                # Since cache keys include all parameters, we'll try to clear
                # entries that might contain this source URL
                pattern = "imgproxy_url:*"
                cache.delete_pattern(pattern)
                logger.info(f"Cleared imgproxy cache pattern: {pattern}")
            except AttributeError:
                # Pattern deletion not available (non-Redis cache)
                # Try to clear common cache key variations
                # Generate cache keys for common parameter combinations
                common_params = [
                    {"width": None, "height": None, "resize_type": "fit", "gravity": "sm"},
                    {"width": 150, "height": 150, "resize_type": "fill", "gravity": "sm"},
                    {"width": 300, "height": 300, "resize_type": "fit"},
                    {"width": 600, "height": 600, "resize_type": "fit"},
                    {"width": 1280, "height": 720, "resize_type": "fill", "gravity": "sm"},
                ]

                for params in common_params:
                    cache_key_parts = [
                        source_url,
                        str(params.get("width")),
                        str(params.get("height")),
                        params.get("resize_type", "fit"),
                        params.get("gravity", "sm"),
                        str(params.get("quality")),
                        str(params.get("format")),
                        str(params.get("preset")),
                    ]
                    cache_key_string = "|".join(str(p) for p in cache_key_parts if p)
                    cache_key = f"imgproxy_url:{hashlib.md5(cache_key_string.encode()).hexdigest()}"
                    cache.delete(cache_key)

                logger.info(f"Cleared imgproxy cache entries for source URL: {source_url}")

        except Exception as e:
            # Don't fail the request if cache clearing fails
            logger.warning(f"Failed to clear imgproxy cache for {source_url}: {e}")

    @action(detail=True, methods=["post"])
    def add_tags(self, request, pk=None):
        """Add tags to a media file. Creates tags if they don't exist."""
        from ..models import MediaTag
        from ..serializers import convert_tag_names_to_ids

        media_file = self.get_object()
        tag_names = request.data.get("tag_names", [])

        if not tag_names:
            return Response(
                {"error": "tag_names is required and must not be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Convert tag names to IDs, creating new tags as needed
            tag_ids = convert_tag_names_to_ids(tag_names, media_file.namespace, request.user)

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

        media_file = self.get_object()
        tag_ids = request.data.get("tag_ids", [])

        if not tag_ids:
            return Response(
                {"error": "tag_ids is required and must not be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from taxonomy.assignments import classification_ids, replace_assignments
        from taxonomy.projections import legacy_media_ids

        remove_ids = set(legacy_media_ids(media_file, tag_ids, request.user))
        remaining = [pk for pk in classification_ids(media_file) if pk not in remove_ids]
        replace_assignments(media_file, remaining, request.user)
        return Response({"message": "Tags removed", "classification_ids": remaining})
