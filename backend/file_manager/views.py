"""
API views for file manager endpoints.

Provides RESTful API for media file management including upload, search,
AI suggestions, and bulk operations.
"""

import logging
from typing import Dict, Any
from django.conf import settings
from django.db import models
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

from .models import MediaFile, MediaTag, MediaCollection, MediaUsage, PendingMediaFile
from .serializers import (
    MediaFileListSerializer,
    MediaFileDetailSerializer,
    MediaTagSerializer,
    MediaCollectionSerializer,
    MediaUploadSerializer,
    MediaSearchSerializer,
    AIMediaSuggestionsSerializer,
    BulkOperationSerializer,
    PendingMediaFileListSerializer,
    PendingMediaFileDetailSerializer,
    MediaFileApprovalSerializer,
    BulkApprovalSerializer,
)
from .storage import storage
from .ai_services import ai_service

logger = logging.getLogger(__name__)


class MediaTagViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media tags."""

    serializer_class = MediaTagSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["created_by"]
    search_fields = ["name", "slug"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        """Filter tags by user's accessible namespaces."""
        from content.models import Namespace
        from django.shortcuts import get_object_or_404

        queryset = MediaTag.objects.select_related("namespace", "created_by")

        # Handle namespace filtering (supports both ID and slug, including "default")
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            try:
                # Try to parse as integer ID first
                namespace_id = int(namespace_param)
                queryset = queryset.filter(namespace_id=namespace_id)
            except ValueError:
                # If not an integer, treat as slug (including "default")
                if namespace_param == "default":
                    # Handle "default" specially to get the default namespace
                    default_namespace = Namespace.get_default()
                    queryset = queryset.filter(namespace=default_namespace)
                else:
                    # Handle other slugs
                    namespace = get_object_or_404(Namespace, slug=namespace_param)
                    queryset = queryset.filter(namespace=namespace)
        else:
            # Use default namespace if none specified (like TagViewSet does)
            default_namespace = Namespace.get_default()
            queryset = queryset.filter(namespace=default_namespace)

        return queryset

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
    filterset_fields = ["file_type", "access_level", "created_by"]
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

        # Filter by namespace if provided (supports both slug and ID)
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            try:
                # Try to parse as integer (ID)
                namespace_id = int(namespace_param)
                queryset = queryset.filter(namespace_id=namespace_id)
            except ValueError:
                # If not an integer, treat as slug
                from content.models import Namespace

                try:
                    namespace = Namespace.objects.get(slug=namespace_param)
                    queryset = queryset.filter(namespace=namespace)
                except Namespace.DoesNotExist:
                    queryset = queryset.none()

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
        print("namespace", namespace)
        # Check namespace access
        if not self._has_namespace_access(request.user, namespace):
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

                # Skip if file already exists in approved media files
                if upload_result.get("existing_file"):
                    existing_file = MediaFile.objects.filter(
                        file_hash=upload_result["file_hash"]
                    ).first()

                    if existing_file:
                        uploaded_files.append(
                            {
                                "id": existing_file.id,
                                "title": existing_file.title,
                                "original_filename": existing_file.original_filename,
                                "file_type": existing_file.file_type,
                                "file_size": existing_file.file_size,
                                "width": existing_file.width,
                                "height": existing_file.height,
                                "ai_suggestions": {
                                    "tags": existing_file.ai_generated_tags,
                                    "title": existing_file.ai_suggested_title,
                                    "confidence_score": existing_file.ai_confidence_score,
                                    "extracted_text": existing_file.ai_extracted_text,
                                },
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

                # Get user for file ownership
                user = request.user

                # Set expiration time (24 hours from now)
                from django.utils import timezone
                from datetime import timedelta

                expires_at = timezone.now() + timedelta(hours=24)

                from content.models import Namespace

                namespace_obj = Namespace.objects.get(slug=namespace)

                # Create PendingMediaFile record instead of MediaFile
                pending_file = PendingMediaFile.objects.create(
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
                    namespace=namespace_obj,
                    folder_path=folder_path,
                    uploaded_by=user,
                    expires_at=expires_at,
                )

                uploaded_files.append(
                    {
                        "id": pending_file.id,
                        "original_filename": pending_file.original_filename,
                        "file_type": pending_file.file_type,
                        "file_size": pending_file.file_size,
                        "width": pending_file.width,
                        "height": pending_file.height,
                        "ai_suggestions": {
                            "tags": ai_analysis.get("suggested_tags", []),
                            "title": ai_analysis.get("suggested_title", ""),
                            "confidence_score": ai_analysis.get(
                                "confidence_score", 0.0
                            ),
                            "extracted_text": ai_analysis.get("extracted_text", ""),
                        },
                        "status": "pending_approval",
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

    def _has_namespace_access(self, user, namespace):
        """
        Check if user has access to the specified namespace.

        Args:
            user: User instance
            namespace: Namespace instance

        Returns:
            bool: True if user has access, False otherwise
        """
        # Staff users have access to all namespaces
        if user.is_staff:
            return True

        # Users have access to namespaces they created
        if namespace.created_by == user:
            return True

        # For now, allow access to active namespaces for authenticated users
        # This can be extended with more granular permissions later
        return namespace.is_active


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
            queryset = queryset.filter(namespace__slug=filters["namespace"])

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


class PendingMediaFileViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing pending media files awaiting approval."""

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter pending files by user and namespace access."""
        queryset = PendingMediaFile.objects.filter(status="pending")

        # Filter by namespace if provided (supports both slug and ID)
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            try:
                # Try to parse as integer (ID)
                namespace_id = int(namespace_param)
                queryset = queryset.filter(namespace_id=namespace_id)
            except ValueError:
                # If not an integer, treat as slug
                from content.models import Namespace

                try:
                    namespace = Namespace.objects.get(slug=namespace_param)
                    queryset = queryset.filter(namespace=namespace)
                except Namespace.DoesNotExist:
                    # If namespace slug doesn't exist, return empty queryset
                    queryset = queryset.none()

        # Users can only see their own pending files unless they're staff
        if not self.request.user.is_staff:
            queryset = queryset.filter(uploaded_by=self.request.user)

        return queryset.order_by("-created_at")

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return PendingMediaFileListSerializer
        return PendingMediaFileDetailSerializer

    @action(
        detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated]
    )
    def preview(self, request, pk=None):
        """Get preview/thumbnail of pending media file."""
        try:
            pending_file = self.get_object()

            # Check if user has access to this file
            if not request.user.is_staff and pending_file.uploaded_by != request.user:
                return Response(
                    {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
                )

            # For images, serve the actual file
            if pending_file.file_type == "image":
                from django.http import HttpResponse
                from .storage import storage

                try:
                    # Get file from storage
                    file_content = storage.get_file_content(pending_file.file_path)

                    response = HttpResponse(
                        file_content, content_type=pending_file.content_type
                    )
                    response["Content-Disposition"] = (
                        f'inline; filename="{pending_file.original_filename}"'
                    )
                    return response

                except Exception as e:
                    logger.error(f"Error serving pending file preview: {str(e)}")
                    return Response(
                        {"error": "File not found"}, status=status.HTTP_404_NOT_FOUND
                    )
            else:
                return Response(
                    {"error": "Preview not available for this file type"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            logger.error(f"Error in preview action: {str(e)}")
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a pending file and create a MediaFile."""
        pending_file = self.get_object()

        # Validate input data
        serializer = MediaFileApprovalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create the approved media file
            media_file = pending_file.approve_and_create_media_file(
                title=serializer.validated_data["title"],
                slug=serializer.validated_data.get("slug"),
                description=serializer.validated_data.get("description", ""),
                tags=serializer.validated_data.get("tag_ids", []),
                access_level=serializer.validated_data.get("access_level", "public"),
            )

            # Return the created media file
            media_serializer = MediaFileDetailSerializer(media_file)
            return Response(
                {"status": "approved", "media_file": media_serializer.data},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to approve file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a pending file and clean up storage."""
        pending_file = self.get_object()

        try:
            pending_file.reject()
            return Response(
                {
                    "status": "rejected",
                    "message": "File has been rejected and removed from storage",
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to reject file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def bulk_approve(self, request):
        """Approve multiple pending files at once."""
        serializer = BulkApprovalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        approvals = serializer.validated_data["approvals"]
        results = []

        for approval_data in approvals:
            try:
                pending_file = PendingMediaFile.objects.get(
                    id=approval_data["pending_file_id"], status="pending"
                )

                # Check permissions
                if (
                    not request.user.is_staff
                    and pending_file.uploaded_by != request.user
                ):
                    results.append(
                        {
                            "pending_file_id": approval_data["pending_file_id"],
                            "status": "error",
                            "error": "Permission denied",
                        }
                    )
                    continue

                # Approve the file
                media_file = pending_file.approve_and_create_media_file(
                    title=approval_data["title"],
                    slug=approval_data.get("slug"),
                    description=approval_data.get("description", ""),
                    tags=approval_data.get("tag_ids", []),
                    access_level=approval_data.get("access_level", "public"),
                )

                results.append(
                    {
                        "pending_file_id": approval_data["pending_file_id"],
                        "status": "approved",
                        "media_file_id": media_file.id,
                    }
                )

            except PendingMediaFile.DoesNotExist:
                results.append(
                    {
                        "pending_file_id": approval_data["pending_file_id"],
                        "status": "error",
                        "error": "Pending file not found",
                    }
                )
            except Exception as e:
                results.append(
                    {
                        "pending_file_id": approval_data["pending_file_id"],
                        "status": "error",
                        "error": str(e),
                    }
                )

        return Response(
            {
                "results": results,
                "summary": {
                    "total": len(approvals),
                    "approved": len([r for r in results if r["status"] == "approved"]),
                    "errors": len([r for r in results if r["status"] == "error"]),
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def bulk_reject(self, request):
        """Reject multiple pending files at once."""
        file_ids = request.data.get("file_ids", [])

        if not file_ids:
            return Response(
                {"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        results = []

        for file_id in file_ids:
            try:
                pending_file = PendingMediaFile.objects.get(
                    id=file_id, status="pending"
                )

                # Check permissions
                if (
                    not request.user.is_staff
                    and pending_file.uploaded_by != request.user
                ):
                    results.append(
                        {
                            "file_id": file_id,
                            "status": "error",
                            "error": "Permission denied",
                        }
                    )
                    continue

                pending_file.reject()
                results.append({"file_id": file_id, "status": "rejected"})

            except PendingMediaFile.DoesNotExist:
                results.append(
                    {
                        "file_id": file_id,
                        "status": "error",
                        "error": "Pending file not found",
                    }
                )
            except Exception as e:
                results.append({"file_id": file_id, "status": "error", "error": str(e)})

        return Response(
            {
                "results": results,
                "summary": {
                    "total": len(file_ids),
                    "rejected": len([r for r in results if r["status"] == "rejected"]),
                    "errors": len([r for r in results if r["status"] == "error"]),
                },
            },
            status=status.HTTP_200_OK,
        )


class MediaSlugValidationView(APIView):
    """Validate slug uniqueness and generate alternatives if needed."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Validate slug uniqueness and return a unique slug.

        Expected payload:
        {
            "title": "My Article Title",
            "namespace": "blog",
            "current_slugs": ["existing-slug-1", "existing-slug-2"]  # Optional: current session slugs
        }

        Returns:
        {
            "slug": "my-article-title-2"  # Original or alternative if conflict
        }
        """
        try:
            # Handle both DRF request.data and regular request.POST/request.body
            if hasattr(request, "data"):
                data = request.data
            else:
                import json

                try:
                    data = json.loads(request.body) if request.body else {}
                except (json.JSONDecodeError, AttributeError):
                    data = request.POST

            title = str(data.get("title", "")).strip()
            namespace_slug = str(data.get("namespace", "")).strip()
            current_slugs = data.get("current_slugs", [])

            if not title:
                return Response(
                    {"error": "Title is required"}, status=status.HTTP_400_BAD_REQUEST
                )

            if not namespace_slug:
                return Response(
                    {"error": "Namespace is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate current_slugs is a list
            if not isinstance(current_slugs, list):
                current_slugs = []

            # Get namespace object by slug
            from content.models import Namespace

            try:
                namespace = Namespace.objects.get(slug=namespace_slug)
            except Namespace.DoesNotExist:
                return Response(
                    {"error": f"Namespace '{namespace_slug}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Generate base slug from title
            base_slug = self._generate_slug(title)

            # Check for uniqueness and generate alternative if needed
            unique_slug = self._get_unique_slug(base_slug, namespace, current_slugs)

            return Response({"slug": unique_slug}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error validating slug: {str(e)}")
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _generate_slug(self, title):
        """Generate a slug from title."""
        import re

        # Convert to lowercase and replace non-alphanumeric with hyphens
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower())
        # Remove leading/trailing hyphens
        slug = slug.strip("-")
        return slug

    def _get_unique_slug(self, base_slug, namespace, current_slugs=None):
        """Get a unique slug by checking existing media files and current session slugs."""
        if current_slugs is None:
            current_slugs = []

        # Check against existing media files in database
        db_slugs = set(
            MediaFile.objects.filter(namespace=namespace).values_list("slug", flat=True)
        )

        # Combine database slugs with current session slugs
        all_existing_slugs = db_slugs | set(current_slugs)

        # If base slug is unique, return it
        if base_slug not in all_existing_slugs:
            return base_slug

        # Generate alternative with counter
        counter = 2
        while f"{base_slug}-{counter}" in all_existing_slugs:
            counter += 1

        return f"{base_slug}-{counter}"
