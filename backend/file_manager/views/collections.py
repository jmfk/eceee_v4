"""
ViewSets for managing media tags and collections.
"""

import logging
import os
import tempfile
import uuid
import zipfile

from django.conf import settings
from django.db import models, transaction
from django.db.models import Count, Q
from django.http import FileResponse, Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from core.roles import is_tenant_admin

from ..models import MediaCollection, MediaFile, MediaTag
from ..security import filter_media_files_for_user, user_can_access_namespace
from ..serializers import (
    MediaCollectionSerializer,
    MediaFileDetailSerializer,
    MediaFileListSerializer,
    MediaTagSerializer,
)
from ..services import FileUploadService, FileValidationService
from ..storage import storage

logger = logging.getLogger(__name__)


def _namespace_visible_to_request(namespace, request):
    """Keep system-owned namespaces inside their owning product boundary."""
    if not namespace.is_hidden:
        return True
    tenant = getattr(request, "tenant", None)
    return (tenant is None or tenant.pk == namespace.tenant_id) and user_can_access_namespace(request.user, namespace)


def _validate_create_namespace(serializer, request):
    """Reject writes to a hidden namespace before the serializer mutates it."""
    from content.models import Namespace

    namespace_data = serializer.validated_data.get("namespace") or {}
    namespace_slug = namespace_data.get("slug")
    tenant = getattr(request, "tenant", None)
    if namespace_slug == "default":
        namespace = Namespace.get_default(tenant=tenant)
    else:
        namespaces = Namespace.objects.all()
        if tenant is not None:
            namespaces = namespaces.filter(tenant=tenant)
        namespace = (
            namespaces.filter(slug=namespace_slug).first() if namespace_slug else Namespace.get_default(tenant=tenant)
        )
    if namespace and not _namespace_visible_to_request(namespace, request):
        raise PermissionDenied("Access denied to specified namespace.")


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
        from django.shortcuts import get_object_or_404

        from content.models import Namespace

        queryset = MediaTag.objects.select_related("namespace", "created_by")
        tenant = getattr(self.request, "tenant", None)
        if tenant is not None:
            queryset = queryset.filter(namespace__tenant=tenant)

        # Handle namespace filtering by slug only
        namespace_param = self.request.query_params.get("namespace")
        if namespace_param:
            if namespace_param == "default":
                # Handle "default" specially to get the default namespace
                namespace = Namespace.get_default(tenant=tenant)
            else:
                # Handle other slugs
                namespaces = Namespace.objects.all()
                if tenant is not None:
                    namespaces = namespaces.filter(tenant=tenant)
                namespace = get_object_or_404(namespaces, slug=namespace_param)
            if not _namespace_visible_to_request(namespace, self.request):
                return queryset.none()
            queryset = queryset.filter(namespace=namespace)
        else:
            # Use default namespace if none specified
            default_namespace = Namespace.get_default(tenant=tenant)
            queryset = queryset.filter(namespace=default_namespace)

        return queryset

    def perform_create(self, serializer):
        """Set created_by when creating tag."""
        _validate_create_namespace(serializer, self.request)
        from taxonomy.legacy import create_legacy

        create_legacy(serializer, self.request.user, created_by=self.request.user)

    def perform_update(self, serializer):
        from taxonomy.legacy import update_legacy

        update_legacy(serializer, self.request.user)

    def perform_destroy(self, instance):
        from taxonomy.legacy import archive_legacy

        archive_legacy(instance, self.request.user)

    @action(detail=True, methods=["get"])
    def files(self, request, pk=None):
        """Get all files using this tag with pagination."""
        tag = self.get_object()

        # Get files with this tag
        files = (
            filter_media_files_for_user(
                MediaFile.objects.filter(tags=tag, namespace=tag.namespace),
                request.user,
                tenant=tag.namespace.tenant,
                include_theme_media=True,
            )
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags", "collections")
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
            serializer = MediaFileListSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = MediaFileListSerializer(files, many=True, context={"request": request})
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
        from taxonomy.legacy import merge_legacy

        return merge_legacy(self, request)

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        """Delete multiple tags at once."""
        from taxonomy.legacy import bulk_archive_legacy

        return bulk_archive_legacy(self, request)


class MediaCollectionViewSet(viewsets.ModelViewSet):
    def filter_queryset(self, queryset):
        from taxonomy.projections import media_term_query
        from taxonomy.services import requested_classifications

        queryset = super().filter_queryset(queryset)
        tenant = getattr(self.request, "tenant", None)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(slug__icontains=search) | media_term_query(tenant, search)
            )
        for name in self.request.query_params.getlist("tag_names"):
            if name.strip():
                queryset = queryset.filter(media_term_query(tenant, name.strip(), exact=True))
        return requested_classifications(self.request, queryset.distinct(), "classification_links__tag_id")

    """ViewSet for managing media collections."""

    serializer_class = MediaCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["title", "created_at", "updated_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        """Filter collections by user's accessible namespaces.

        For list-style requests we honour the ``namespace`` query param and
        otherwise default to the system's default namespace, preserving the
        existing list/browse behaviour.

        For detail-style requests (retrieve, update, destroy, and custom
        ``@action(detail=True)`` endpoints such as ``files``,
        ``add_files``, ``remove_files``, ``upload_to_collection``,
        ``download_zip``) we look the collection up by primary key across all
        namespaces. The collection ID is already a UUID, so this is safe and
        avoids surfacing misleading 404s in production whenever the caller
        omits the ``namespace`` query param for a collection that does not
        live in the default namespace.
        """
        from content.models import Namespace

        queryset = (
            MediaCollection.objects.with_deleted()
            .filter(is_deleted=getattr(self, "action", None) == "trash")
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags")
        )
        tenant = getattr(self.request, "tenant", None)
        if tenant is not None:
            queryset = queryset.filter(namespace__tenant=tenant)

        # Detect detail-style requests. ``self.kwargs[self.lookup_field]``
        # is populated by DRF when the URL includes the collection PK, which
        # is the case for retrieve/update/destroy and any
        # ``@action(detail=True)`` endpoint.
        lookup_value = self.kwargs.get(self.lookup_field) if self.kwargs else None

        namespace_slug = self.request.query_params.get("namespace")
        if namespace_slug:
            if namespace_slug == "default":
                namespace = Namespace.get_default(tenant=tenant)
            else:
                namespaces = Namespace.objects.all()
                if tenant is not None:
                    namespaces = namespaces.filter(tenant=tenant)
                namespace = namespaces.filter(slug=namespace_slug).first()
            if not namespace or not _namespace_visible_to_request(namespace, self.request):
                return queryset.none()
            return queryset.filter(namespace=namespace)

        if lookup_value:
            # Detail/action lookup by ID — do not restrict by namespace so
            # that callers without a ``namespace`` param can still resolve
            # collections in non-default namespaces.
            namespace = queryset.filter(pk=lookup_value).values_list("namespace", flat=True).first()
            if namespace:
                namespace = Namespace.objects.filter(pk=namespace).first()
                if namespace and not _namespace_visible_to_request(namespace, self.request):
                    return queryset.none()
            return queryset

        # List-style request without an explicit namespace: fall back to the
        # default namespace to keep the browse experience scoped.
        default_namespace = Namespace.get_default(tenant=tenant)
        return queryset.filter(namespace=default_namespace)

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)

    @action(detail=False, methods=["get"])
    def trash(self, request):
        """List deleted collections in the selected tenant and namespace."""
        queryset = self.filter_queryset(self.get_queryset().order_by("-deleted_at"))
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore the collection and its memberships; files remain independently deleted."""
        tenant = getattr(request, "tenant", None)
        queryset = MediaCollection.objects.with_deleted().filter(pk=pk, is_deleted=True).select_related("namespace")
        if tenant is not None:
            queryset = queryset.filter(namespace__tenant=tenant)
        collection = queryset.first()
        if collection is None or not _namespace_visible_to_request(collection.namespace, request):
            raise Http404
        self.check_object_permissions(request, collection)
        collection.restore()
        return Response(self.get_serializer(collection).data)

    @action(detail=False, methods=["post"])
    def bulk_restore(self, request):
        raw_ids = request.data.get("collection_ids")
        if not isinstance(raw_ids, list) or not 1 <= len(raw_ids) <= 100:
            return Response({"error": "Select between 1 and 100 collections"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ids = {uuid.UUID(str(value)) for value in raw_ids}
        except (TypeError, ValueError, AttributeError):
            return Response({"error": "Invalid collection ID"}, status=status.HTTP_400_BAD_REQUEST)
        tenant = getattr(request, "tenant", None)
        with transaction.atomic():
            queryset = MediaCollection.objects.with_deleted().filter(pk__in=ids, is_deleted=True)
            if tenant is not None:
                queryset = queryset.filter(namespace__tenant=tenant)
            collections = list(queryset.select_related("namespace").select_for_update())
            if len(collections) != len(ids) or any(
                not _namespace_visible_to_request(collection.namespace, request) for collection in collections
            ):
                return Response({"error": "One or more collections are unavailable"}, status=status.HTTP_404_NOT_FOUND)
            for collection in collections:
                self.check_object_permissions(request, collection)
                collection.restore()
        return Response({"restored_count": len(collections)})

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        """Atomically move selected collections, and optionally their files, to Trash."""
        raw_ids = request.data.get("collection_ids")
        if not isinstance(raw_ids, list) or not 1 <= len(raw_ids) <= 100:
            return Response({"error": "Select between 1 and 100 collections"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ids = {uuid.UUID(str(value)) for value in raw_ids}
        except (TypeError, ValueError, AttributeError):
            return Response({"error": "Invalid collection ID"}, status=status.HTTP_400_BAD_REQUEST)
        delete_files = request.data.get("delete_files", False)
        if not isinstance(delete_files, bool):
            return Response({"error": "delete_files must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            collections = list(self.get_queryset().filter(pk__in=ids).select_for_update())
            if len(collections) != len(ids):
                return Response({"error": "One or more collections are unavailable"}, status=status.HTTP_404_NOT_FOUND)
            files = []
            if delete_files:
                file_ids = MediaFile.objects.filter(collections__in=collections).values_list("pk", flat=True)
                files = list(
                    MediaFile.objects.filter(pk__in=file_ids).select_for_update().prefetch_related("collections")
                )
                selected_ids = {collection.id for collection in collections}
                selected_namespace_ids = {collection.namespace_id for collection in collections}
                selected_tenant_ids = {collection.namespace.tenant_id for collection in collections}
                can_delete_other_users_files = is_tenant_admin(request.user, collections[0].namespace.tenant)
                conflicts = [
                    str(file.id)
                    for file in files
                    if file.namespace_id not in selected_namespace_ids
                    or file.tenant_id not in selected_tenant_ids
                    or (file.created_by_id != request.user.id and not can_delete_other_users_files)
                    or file.reference_count > 0
                    or file.protected_from_cleanup
                    or any(not member.is_deleted and member.id not in selected_ids for member in file.collections.all())
                ]
                if conflicts:
                    return Response(
                        {
                            "error": (
                                "Some files are unavailable, referenced, protected, or shared with collections "
                                "outside the selection"
                            ),
                            "file_ids": conflicts,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                for file in files:
                    if not file.delete(user=request.user):
                        raise ValidationError({"error": "A file could not be moved to Trash"})
            for collection in collections:
                collection.soft_delete(request.user)
        return Response({"deleted_count": len(collections), "deleted_file_count": len(files)})

    def create(self, request, *args, **kwargs):
        """Create a new collection with tag validation."""
        # Validate that at least one tag is provided
        # Check both snake_case and camelCase to handle case conversion
        tag_ids = request.data.get("tag_ids") or request.data.get("tagIds", [])
        if not tag_ids and not (request.data.get("classification_ids") or request.data.get("classificationIds")):
            return Response(
                {
                    "error": "At least one tag is required to create a collection",
                    "detail": "Collections must have tags to accept uploads.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Set user fields when creating collection."""
        _validate_create_namespace(serializer, self.request)
        serializer.save(created_by=self.request.user, last_modified_by=self.request.user)

    def perform_update(self, serializer):
        """Set last_modified_by when updating collection."""
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["get"])
    def files(self, request, pk=None):
        """Get files in this collection."""
        try:
            collection = self.get_object()

            # Get files in this collection with proper permissions
            files = (
                filter_media_files_for_user(
                    MediaFile.objects.filter(collections=collection, namespace=collection.namespace),
                    request.user,
                    tenant=collection.namespace.tenant,
                    include_theme_media=True,
                )
                .select_related("namespace", "created_by", "last_modified_by")
                .prefetch_related("tags", "collections")
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
                serializer = MediaFileListSerializer(page, many=True, context={"request": request})
                return self.get_paginated_response(serializer.data)

            serializer = MediaFileListSerializer(files, many=True, context={"request": request})
            return Response(serializer.data)
        except Http404:
            raise
        except Exception as e:
            logger.error(f"Error fetching collection files: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Failed to fetch collection files: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=["post"])
    def add_files(self, request, pk=None):
        """Add files to a collection."""
        collection = self.get_object()
        file_ids = request.data.get("file_ids", [])

        if not file_ids:
            return Response({"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Get files that exist and belong to the same namespace
        files = MediaFile.objects.filter(id__in=file_ids, namespace=collection.namespace)

        if not files.exists():
            return Response({"error": "No valid files found"}, status=status.HTTP_404_NOT_FOUND)

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
            return Response({"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

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
        if not collection.can_accept_uploads():
            return Response(
                {
                    "error": "Collection must have at least one tag before uploading files",
                    "detail": "Please add tags to the collection first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get uploaded files from request
        files = request.FILES.getlist("files")
        if not files:
            return Response({"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

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
        from taxonomy.assignments import collection_upload_ids

        collection_ids = collection_upload_ids(collection, request.user)

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
                            classification_ids=collection_ids,
                            user=request.user,
                            access_level="public",
                        )

                        # Add to collection
                        collection.mediafile_set.add(media_file)

                        uploaded_files.append(media_file)

                    except Exception as e:
                        logger.error(f"Error auto-approving file {pending_file.original_filename}: {e}")
                        errors.append(
                            {
                                "filename": pending_file.original_filename,
                                "error": f"Failed to approve file: {str(e)}",
                                "status": "error",
                            }
                        )

            except Exception as e:
                logger.error(f"Error processing file {uploaded_file.name}: {e}")
                errors.append({"filename": uploaded_file.name, "error": str(e), "status": "error"})

        # Build response
        response_data = {
            "success": len(uploaded_files) > 0,
            "uploaded_count": len(uploaded_files),
            "error_count": len(errors),
            "message": f"Successfully uploaded {len(uploaded_files)} file(s) to collection",
        }

        if uploaded_files:
            # Serialize uploaded files
            serializer = MediaFileDetailSerializer(uploaded_files, many=True, context={"request": request})
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
            collections=collection, namespace=collection.namespace, is_deleted=False
        ).select_related("namespace")

        if not files.exists():
            return Response({"error": "Collection has no files to download"}, status=status.HTTP_400_BAD_REQUEST)

        # Create a temporary file for the ZIP
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        temp_zip_path = temp_zip.name
        temp_zip.close()

        try:
            # Create ZIP file
            with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
                for media_file in files:
                    try:
                        # Get the file from storage
                        file_path = media_file.file_path

                        # Download file content from storage
                        file_content = storage.get_file_content(file_path)

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
            zip_file_handle = open(temp_zip_path, "rb")

            # Create response with ZIP file
            response = FileResponse(zip_file_handle, content_type="application/zip")

            # Set download filename
            safe_filename = collection.slug or f"collection-{collection.id}"
            response["Content-Disposition"] = f'attachment; filename="{safe_filename}.zip"'

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
                {"error": f"Failed to create ZIP archive: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
