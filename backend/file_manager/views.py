"""
API views for file manager endpoints.

Provides RESTful API for media file management including upload, search,
AI suggestions, and bulk operations.
"""

import logging
from typing import Dict, Any
from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import MediaFile, MediaTag, MediaCollection, MediaThumbnail, MediaUsage
from .serializers import (
    MediaFileListSerializer,
    MediaFileDetailSerializer,
    MediaTagSerializer,
    MediaCollectionSerializer,
    MediaUploadSerializer,
    MediaSearchSerializer,
    AIMediaSuggestionsSerializer,
    BulkOperationSerializer,
)
from .storage import storage
from .ai_services import ai_service

logger = logging.getLogger(__name__)


class MediaTagViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media tags."""

    serializer_class = MediaTagSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["namespace", "created_by"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        """Filter tags by user's accessible namespaces."""
        # TODO: Add proper namespace filtering based on user permissions
        return MediaTag.objects.select_related("namespace", "created_by")

    def perform_create(self, serializer):
        """Set created_by when creating tag."""
        serializer.save(created_by=self.request.user)


class MediaCollectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media collections."""

    serializer_class = MediaCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["namespace", "access_level", "created_by"]
    search_fields = ["title", "description"]
    ordering_fields = ["title", "created_at", "updated_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        """Filter collections by user's accessible namespaces."""
        # TODO: Add proper namespace filtering based on user permissions
        return MediaCollection.objects.select_related(
            "namespace", "created_by", "last_modified_by"
        ).prefetch_related("tags")


class MediaFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media files with security controls."""

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["file_type", "access_level", "namespace", "created_by"]
    search_fields = ["title", "description", "original_filename", "ai_extracted_text"]
    ordering_fields = ["title", "created_at", "updated_at", "file_size"]
    ordering = ["-created_at"]

    def get_permissions(self):
        """Get permissions based on action."""
        from .security import MediaFilePermission

        return [MediaFilePermission()]

    def get_queryset(self):
        """Filter queryset based on user permissions and namespace access."""
        from .security import SecurityAuditLogger

        user = self.request.user

        # Staff users see all files
        if user.is_staff:
            return MediaFile.objects.select_related(
                "namespace", "created_by", "last_modified_by"
            ).prefetch_related("tags", "collections")

        # Regular users only see files from accessible namespaces
        accessible_namespaces = user.accessible_namespaces.all()
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

        return queryset

    def perform_create(self, serializer):
        """Set user and perform security logging on create."""
        from .security import SecurityAuditLogger

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
        from .security import SecurityAuditLogger

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

    def get_queryset(self):
        """Filter files by user's accessible namespaces."""
        # TODO: Add proper namespace filtering based on user permissions
        queryset = MediaFile.objects.select_related(
            "namespace", "created_by", "last_modified_by"
        ).prefetch_related("tags", "collections", "thumbnails")

        return queryset

    def perform_update(self, serializer):
        """Set last_modified_by when updating file."""
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Download file with access tracking."""
        media_file = self.get_object()

        # Update access tracking
        media_file.download_count += 1
        media_file.last_accessed = timezone.now()
        media_file.save(update_fields=["download_count", "last_accessed"])

        # Get signed URL for secure access
        signed_url = storage.get_signed_url(media_file.file_path)

        if signed_url:
            # Redirect to signed URL
            from django.shortcuts import redirect

            return redirect(signed_url)
        else:
            # Fallback to public URL
            public_url = storage.get_public_url(media_file.file_path)
            return redirect(public_url)

    @action(detail=True, methods=["get"])
    def thumbnail(self, request, pk=None):
        """Get thumbnail for image files."""
        media_file = self.get_object()

        if not media_file.is_image:
            raise Http404("Thumbnails only available for images")

        size = request.query_params.get("size", "medium")

        try:
            thumbnail = media_file.thumbnails.get(size=size)
            signed_url = storage.get_signed_url(thumbnail.file_path)

            if signed_url:
                from django.shortcuts import redirect

                return redirect(signed_url)
            else:
                raise Http404("Thumbnail not accessible")

        except MediaThumbnail.DoesNotExist:
            raise Http404("Thumbnail not found")


class MediaUploadView(APIView):
    """Handle file uploads with AI analysis and security validation."""

    # Require authentication for uploads
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        """Upload multiple files with comprehensive security validation."""
        from .security import FileUploadValidator, SecurityAuditLogger

        serializer = MediaUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        files = serializer.validated_data["files"]
        folder_path = serializer.validated_data.get("folder_path", "")
        namespace = serializer.validated_data["namespace"]

        # Check namespace access
        if not request.user.accessible_namespaces.filter(id=namespace.id).exists():
            SecurityAuditLogger.log_security_violation(
                request.user,
                "unauthorized_namespace_access",
                f"Attempted access to namespace: {namespace.id}",
            )
            return Response(
                {"error": "Access denied to specified namespace"},
                status=status.HTTP_403_FORBIDDEN,
            )

        uploaded_files = []
        errors = []

        for uploaded_file in files:
            # Comprehensive security validation
            validation_result = FileUploadValidator.validate_file(uploaded_file)

            if not validation_result["is_valid"]:
                error_msg = f"File '{uploaded_file.name}' failed validation: {'; '.join(validation_result['errors'])}"
                errors.append(error_msg)
                SecurityAuditLogger.log_file_upload(
                    request.user,
                    {"filename": uploaded_file.name, "size": uploaded_file.size},
                    success=False,
                )
                continue

            # Log warnings if any
            if validation_result["warnings"]:
                logger.warning(
                    f"File upload warnings for '{uploaded_file.name}': {validation_result['warnings']}"
                )

            # Use validated metadata
            validated_metadata = validation_result["metadata"]
            try:
                # Upload to S3
                upload_result = storage.upload_file(uploaded_file, folder_path)

                # Skip if file already exists
                if upload_result.get("existing_file"):
                    existing_file = MediaFile.objects.filter(
                        file_hash=upload_result["file_hash"]
                    ).first()

                    if existing_file:
                        uploaded_files.append(
                            {
                                "id": existing_file.id,
                                "title": existing_file.title,
                                "status": "exists",
                                "message": "File already exists",
                            }
                        )
                        continue

                # AI analysis
                ai_analysis = ai_service.analyze_media_file(
                    uploaded_file.read(),
                    uploaded_file.name,
                    upload_result["content_type"],
                )
                uploaded_file.seek(0)  # Reset file pointer

                # Determine file type
                content_type = upload_result["content_type"]
                if content_type.startswith("image/"):
                    file_type = "image"
                elif content_type.startswith("video/"):
                    file_type = "video"
                elif content_type.startswith("audio/"):
                    file_type = "audio"
                elif content_type in ["application/pdf", "application/msword"]:
                    file_type = "document"
                else:
                    file_type = "other"

                # Get user for file ownership (use admin user if anonymous for debugging)
                from django.contrib.auth.models import User

                user = (
                    request.user
                    if request.user.is_authenticated
                    else User.objects.get(id=1)
                )

                # Create MediaFile record
                media_file = MediaFile.objects.create(
                    title=ai_analysis.get("suggested_title") or uploaded_file.name,
                    slug=ai_analysis.get("suggested_slug") or uploaded_file.name,
                    original_filename=uploaded_file.name,
                    file_path=upload_result["file_path"],
                    file_size=upload_result["file_size"],
                    content_type=upload_result["content_type"],
                    file_hash=upload_result["file_hash"],
                    file_type=file_type,
                    width=upload_result.get("width"),
                    height=upload_result.get("height"),
                    ai_generated_tags=ai_analysis.get("suggested_tags", []),
                    ai_suggested_title=ai_analysis.get("suggested_title", ""),
                    ai_extracted_text=ai_analysis.get("extracted_text", ""),
                    ai_confidence_score=ai_analysis.get("confidence_score", 0.0),
                    namespace=namespace,
                    created_by=user,
                    last_modified_by=user,
                )

                # Create thumbnail records
                for thumbnail_data in upload_result.get("thumbnail_paths", []):
                    MediaThumbnail.objects.create(
                        media_file=media_file,
                        size=thumbnail_data["size"],
                        file_path=thumbnail_data["path"],
                        width=thumbnail_data["width"],
                        height=thumbnail_data["height"],
                        file_size=thumbnail_data["file_size"],
                    )

                uploaded_files.append(
                    {
                        "id": media_file.id,
                        "title": media_file.title,
                        "file_type": media_file.file_type,
                        "file_size": media_file.file_size,
                        "ai_suggestions": {
                            "tags": ai_analysis.get("suggested_tags", []),
                            "title": ai_analysis.get("suggested_title", ""),
                            "confidence": ai_analysis.get("confidence_score", 0.0),
                        },
                        "status": "uploaded",
                    }
                )

            except Exception as e:
                logger.error(f"Upload failed for {uploaded_file.name}: {e}")
                errors.append({"filename": uploaded_file.name, "error": str(e)})

        response_data = {
            "uploaded_files": uploaded_files,
            "success_count": len(uploaded_files),
            "error_count": len(errors),
        }

        if errors:
            response_data["errors"] = errors

        return Response(response_data, status=status.HTTP_201_CREATED)


class MediaSearchView(APIView):
    """Advanced search for media files."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Search media files with advanced filters."""
        serializer = MediaSearchSerializer(data=request.query_params)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Start with base queryset
        queryset = MediaFile.objects.select_related(
            "namespace", "created_by"
        ).prefetch_related("tags", "collections")

        # Apply filters
        filters = serializer.validated_data

        if filters.get("q"):
            # Full-text search
            query = filters["q"]
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(original_filename__icontains=query)
                | Q(ai_extracted_text__icontains=query)
                | Q(tags__name__icontains=query)
            ).distinct()

        if filters.get("file_type"):
            queryset = queryset.filter(file_type=filters["file_type"])

        if filters.get("tags"):
            queryset = queryset.filter(tags__id__in=filters["tags"])

        if filters.get("collections"):
            queryset = queryset.filter(collections__id__in=filters["collections"])

        if filters.get("access_level"):
            queryset = queryset.filter(access_level=filters["access_level"])

        if filters.get("namespace"):
            queryset = queryset.filter(namespace=filters["namespace"])

        if filters.get("created_after"):
            queryset = queryset.filter(created_at__gte=filters["created_after"])

        if filters.get("created_before"):
            queryset = queryset.filter(created_at__lte=filters["created_before"])

        if filters.get("min_size"):
            queryset = queryset.filter(file_size__gte=filters["min_size"])

        if filters.get("max_size"):
            queryset = queryset.filter(file_size__lte=filters["max_size"])

        # Pagination
        from django.core.paginator import Paginator

        page_size = min(int(request.query_params.get("page_size", 20)), 100)
        page_number = int(request.query_params.get("page", 1))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        # Serialize results
        serializer = MediaFileListSerializer(page.object_list, many=True)

        return Response(
            {
                "results": serializer.data,
                "count": paginator.count,
                "page": page_number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "has_next": page.has_next(),
                "has_previous": page.has_previous(),
            }
        )


class MediaAISuggestionsView(APIView):
    """API view for generating AI suggestions for media files."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Generate AI suggestions for a media file."""
        serializer = AIMediaSuggestionsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid request data", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        media_file = serializer.validated_data["file_id"]

        try:
            # Check if user has access to this file
            if media_file.namespace and not request.user.has_perm(
                "content.view_namespace", media_file.namespace
            ):
                return Response(
                    {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
                )

            # Get file content from storage
            file_content = storage.get_file_content(media_file.file_path)
            if not file_content:
                return Response(
                    {"error": "Could not retrieve file content"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Generate AI analysis
            ai_analysis = ai_service.analyze_media_file(
                file_content=file_content,
                filename=media_file.original_filename,
                content_type=media_file.content_type,
            )

            # Generate slug suggestions
            existing_slugs = list(
                MediaFile.objects.filter(namespace=media_file.namespace).values_list(
                    "slug", flat=True
                )
            )

            slug_suggestions = ai_service.generate_slug_suggestions(
                title=ai_analysis.get("suggested_title", media_file.title),
                existing_slugs=existing_slugs,
            )

            # Generate collection suggestions
            existing_collections = list(
                MediaCollection.objects.filter(
                    namespace=media_file.namespace
                ).values_list("name", flat=True)
            )

            collection_suggestions = ai_service.suggest_collections(
                tags=ai_analysis.get("suggested_tags", []),
                existing_collections=existing_collections,
            )

            return Response(
                {
                    "file_id": str(media_file.id),
                    "suggestions": {
                        "tags": ai_analysis.get("suggested_tags", []),
                        "title": ai_analysis.get("suggested_title", ""),
                        "slugs": slug_suggestions,
                        "collections": collection_suggestions,
                        "extracted_text": ai_analysis.get("extracted_text", ""),
                        "confidence_score": ai_analysis.get("confidence_score", 0.0),
                        "metadata": ai_analysis.get("analysis_metadata", {}),
                    },
                    "generated_at": timezone.now().isoformat(),
                }
            )

        except Exception as e:
            logger.error(f"AI suggestions failed for file {media_file.id}: {e}")
            return Response(
                {"error": "Failed to generate AI suggestions", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MediaFileBySlugView(APIView):
    """Access media files by SEO-friendly slug."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, namespace_slug, file_slug):
        """Get media file by namespace and file slug."""
        try:
            from content.models import Namespace

            namespace = Namespace.objects.get(slug=namespace_slug)
            media_file = MediaFile.objects.get(slug=file_slug, namespace=namespace)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                from django.shortcuts import redirect

                return redirect(signed_url)
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                return redirect(public_url)

        except (Namespace.DoesNotExist, MediaFile.DoesNotExist):
            raise Http404("Media file not found")


class MediaFileByUUIDView(APIView):
    """Access media files by UUID (fallback/direct access)."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, file_uuid):
        """Get media file by UUID."""
        try:
            media_file = MediaFile.objects.get(id=file_uuid)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                from django.shortcuts import redirect

                return redirect(signed_url)
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                return redirect(public_url)

        except MediaFile.DoesNotExist:
            raise Http404("Media file not found")


class MediaFileDownloadView(APIView):
    """Download media files with proper headers."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, namespace_slug, file_slug):
        """Download media file by namespace and file slug."""
        try:
            from content.models import Namespace

            namespace = Namespace.objects.get(slug=namespace_slug)
            media_file = MediaFile.objects.get(slug=file_slug, namespace=namespace)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                from django.shortcuts import redirect

                response = redirect(signed_url)
                # Add download headers
                response["Content-Disposition"] = (
                    f'attachment; filename="{media_file.original_filename}"'
                )
                return response
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                response = redirect(public_url)
                response["Content-Disposition"] = (
                    f'attachment; filename="{media_file.original_filename}"'
                )
                return response

        except (Namespace.DoesNotExist, MediaFile.DoesNotExist):
            raise Http404("Media file not found")
