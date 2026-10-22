"""
Views for media file search and AI suggestions.
"""

import logging

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..ai_services import ai_service
from ..models import MediaCollection, MediaFile
from ..security import filter_media_files_for_user
from ..serializers import (
    AIMediaSuggestionsSerializer,
    MediaFileListSerializer,
    MediaSearchSerializer,
)
from ..storage import storage

logger = logging.getLogger(__name__)


class MediaSearchView(APIView):
    """Advanced search for media files."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Search media files with advanced filters."""
        serializer = MediaSearchSerializer(data=request.query_params)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filters = serializer.validated_data
        tenant = getattr(request, "tenant", None)
        include_theme_media = False
        if filters.get("namespace"):
            from content.models import Namespace

            from ..security import user_can_access_namespace

            theme_namespace = Namespace.objects.filter(
                slug=filters["namespace"],
                tenant=tenant,
                is_hidden=True,
            ).first()
            include_theme_media = bool(theme_namespace and user_can_access_namespace(request.user, theme_namespace))

        # Start with base queryset
        queryset = (
            filter_media_files_for_user(
                MediaFile.objects.all(),
                request.user,
                tenant=tenant,
                include_theme_media=include_theme_media,
            )
            .select_related("namespace", "created_by")
            .prefetch_related("tags", "collections")
        )

        from taxonomy.projections import media_term_query

        # Apply filters
        # Handle legacy search (q parameter) - for backward compatibility
        if filters.get("q"):
            query = filters["q"]
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(original_filename__icontains=query)
                | Q(ai_extracted_text__icontains=query)
                | media_term_query(tenant, query)
            ).distinct()

        # Handle new structured search
        # Text search - searches in title and tag names for better discoverability
        if filters.get("text_search"):
            text_query = filters["text_search"]
            queryset = queryset.filter(Q(title__icontains=text_query) | media_term_query(tenant, text_query)).distinct()

        # Tag search - must match ALL provided tags (AND logic)
        if filters.get("tag_names"):
            tag_names = filters["tag_names"]
            for tag_name in tag_names:
                queryset = queryset.filter(media_term_query(tenant, tag_name, exact=True))

        # Text-based tag search - match against tag names and slugs
        if filters.get("text_tags"):
            text_tags = filters["text_tags"]
            for text_tag in text_tags:
                queryset = queryset.filter(media_term_query(tenant, text_tag)).distinct()

        # Handle file type filtering (multiple types supported)
        if filters.get("file_types"):
            queryset = queryset.filter(file_type__in=filters["file_types"])
        elif filters.get("file_type"):
            # Backward compatibility for single file_type
            queryset = queryset.filter(file_type=filters["file_type"])

        # Handle MIME type filtering
        if filters.get("mime_types"):
            queryset = queryset.filter(content_type__in=filters["mime_types"])

        # Legacy tags filter (by UUID) - for backward compatibility
        if filters.get("tags"):
            queryset = queryset.filter(tags__id__in=filters["tags"])

        if filters.get("collections"):
            queryset = queryset.filter(collections__id__in=filters["collections"])

        if filters.get("access_level"):
            queryset = queryset.filter(access_level=filters["access_level"])

        if filters.get("namespace"):
            from content.models import Namespace

            try:
                namespace = Namespace.resolve(filters["namespace"], tenant=tenant)
            except Namespace.DoesNotExist:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(namespace=namespace)

        if request.query_params.get("has_tags", "").lower() == "true":
            queryset = queryset.filter(tags__isnull=False).distinct()

        if filters.get("created_after"):
            queryset = queryset.filter(created_at__gte=filters["created_after"])

        if filters.get("created_before"):
            queryset = queryset.filter(created_at__lte=filters["created_before"])

        if filters.get("min_size"):
            queryset = queryset.filter(file_size__gte=filters["min_size"])

        if filters.get("max_size"):
            queryset = queryset.filter(file_size__lte=filters["max_size"])

        from taxonomy.services import requested_classifications

        queryset = requested_classifications(request, queryset, "classification_links__tag_id").distinct()

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
            if media_file.namespace and not request.user.has_perm("content.view_namespace", media_file.namespace):
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

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
                MediaFile.objects.filter(namespace=media_file.namespace).values_list("slug", flat=True)
            )

            slug_suggestions = ai_service.generate_slug_suggestions(
                title=ai_analysis.get("suggested_title", media_file.title),
                existing_slugs=existing_slugs,
            )

            # Generate collection suggestions
            existing_collections = list(
                MediaCollection.objects.filter(namespace=media_file.namespace).values_list("name", flat=True)
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
