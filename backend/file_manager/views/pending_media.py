"""
ViewSet for managing pending media files awaiting approval.
"""

import logging
from django.utils import timezone
from django.http import Http404, HttpResponse
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import PendingMediaFile, MediaFile, MediaCollection
from ..serializers import (
    PendingMediaFileListSerializer,
    PendingMediaFileDetailSerializer,
    MediaFileDetailSerializer,
    MediaFileApprovalSerializer,
    BulkApprovalSerializer,
)
from ..storage import storage

logger = logging.getLogger(__name__)


class PendingMediaFileViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing pending media files awaiting approval."""

    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """
        Override permissions for preview action.
        
        Preview needs to be public since <img> tags can't send auth headers.
        """
        if self.action == "preview":
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_object(self):
        """
        Override get_object for preview action to bypass user filtering.
        
        For preview, we need to allow anonymous access, so we can't filter
        by user which would cause errors with AnonymousUser objects.
        """
        if self.action == "preview":
            # Get object directly without user filtering
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
            obj = PendingMediaFile.objects.get(**filter_kwargs)
            return obj
        return super().get_object()

    def get_queryset(self):
        """Filter pending files by user and namespace access."""
        # For approval/rejection actions, allow access to all statuses
        if self.action in ["approve", "reject", "preview"]:
            # Allow accessing all statuses for these actions
            queryset = PendingMediaFile.objects.all()
        else:
            # For list/retrieve actions, only show pending files
            queryset = PendingMediaFile.objects.filter(status="pending")

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
                # If namespace slug doesn't exist, return empty queryset
                queryset = queryset.none()

        # For preview action, don't filter by user (anonymous access allowed)
        # Just return the base queryset without user filtering
        if self.action == "preview":
            return queryset

        # Users can only see their own pending files unless they're staff
        if self.request.user.is_authenticated and not self.request.user.is_staff:
            queryset = queryset.filter(uploaded_by=self.request.user)

        return queryset.order_by("-created_at")

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return PendingMediaFileListSerializer
        return PendingMediaFileDetailSerializer

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """
        Get preview/thumbnail of pending media file.
        
        Public endpoint since <img> tags can't send auth headers.
        File access is secured by UUID (hard to guess).
        """
        try:
            logger.info(f"Preview request for pk={pk}, user={request.user}, authenticated={request.user.is_authenticated}")
            
            pending_file = self.get_object()
            logger.info(f"Got pending file: {pending_file.id}, status={pending_file.status}")

            # For images, serve the actual file
            if pending_file.file_type == "image":
                try:
                    # Get file from storage
                    file_content = storage.get_file_content(pending_file.file_path)

                    response = HttpResponse(
                        file_content, content_type=pending_file.content_type
                    )
                    response["Content-Disposition"] = (
                        f'inline; filename="{pending_file.original_filename}"'
                    )
                    logger.info(f"Successfully served preview for {pending_file.original_filename}")
                    return response

                except Exception as e:
                    logger.error(f"Error serving pending file preview: {str(e)}", exc_info=True)
                    return Response(
                        {"error": "File not found"}, status=status.HTTP_404_NOT_FOUND
                    )
            else:
                return Response(
                    {"error": "Preview not available for this file type"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            logger.error(f"Error in preview action: {str(e)}", exc_info=True)
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a pending file and create a MediaFile."""
        try:
            pending_file = self.get_object()
        except (PendingMediaFile.DoesNotExist, Http404):
            return Response(
                {"error": "Pending file not found or already processed"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # If file is already approved or we found an existing file, merge tags
        existing_file = MediaFile.objects.filter(
            file_hash=pending_file.file_hash, namespace=pending_file.namespace
        ).first()

        if existing_file:
            # Get new tags from the approval data
            new_tag_ids = request.data.get("tag_ids", [])
            if new_tag_ids:
                # Add new tags to existing file
                existing_file.tags.add(*new_tag_ids)
                existing_file.save()

            # Handle collection assignment if requested
            collection_id = request.data.get("collection_id")
            collection_name = request.data.get("collection_name")

            if collection_id or collection_name:
                try:
                    collection = self._get_or_create_collection(
                        collection_id,
                        collection_name,
                        pending_file.namespace,
                        request.user,
                    )
                    if collection:
                        existing_file.collections.add(collection)
                except Exception:
                    # Don't fail if collection assignment fails
                    pass

            # Mark pending file as approved
            pending_file.status = "approved"
            pending_file.save()

            media_serializer = MediaFileDetailSerializer(existing_file)
            return Response(
                {
                    "status": "approved",
                    "media_file": media_serializer.data,
                    "message": "Tags merged with existing file",
                },
                status=status.HTTP_200_OK,
            )

        # Validate input data with context
        serializer = MediaFileApprovalSerializer(
            data=request.data,
            context={"namespace": pending_file.namespace, "user": request.user},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            logger.info(
                f"Starting approval process for pending file: {pending_file.id}"
            )
            # Create the approved media file
            media_file = pending_file.approve_and_create_media_file(
                title=serializer.validated_data["title"],
                slug=serializer.validated_data.get("slug"),
                description=serializer.validated_data.get("description", ""),
                tags=serializer.validated_data.get("tag_ids", []),
                access_level=serializer.validated_data.get("access_level", "public"),
            )
            logger.info(
                f"Successfully created MediaFile: {media_file.id} from pending file: {pending_file.id}"
            )

            # Handle collection assignment
            collection_id = serializer.validated_data.get("collection_id")
            collection_name = serializer.validated_data.get("collection_name")

            if collection_id or collection_name:
                try:
                    collection = self._get_or_create_collection(
                        collection_id,
                        collection_name,
                        pending_file.namespace,
                        request.user,
                    )
                    if collection:
                        media_file.collections.add(collection)
                except Exception:
                    # Don't fail the approval if collection assignment fails
                    pass

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

    def _get_or_create_collection(
        self, collection_id, collection_name, namespace, user
    ):
        """Get existing collection or create new one."""
        if collection_id:
            try:
                return MediaCollection.objects.get(
                    id=collection_id, namespace=namespace
                )
            except MediaCollection.DoesNotExist:
                return None
        elif collection_name:
            collection, created = MediaCollection.objects.get_or_create(
                title=collection_name,
                namespace=namespace,
                defaults={
                    "created_by": user,
                    "last_modified_by": user,
                    "access_level": "public",
                },
            )
            return collection
        return None

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

                # Convert tag names to tag IDs for this specific file's namespace
                from ..serializers import convert_tag_names_to_ids

                tag_ids = convert_tag_names_to_ids(
                    approval_data.get("tag_ids", []),
                    pending_file.namespace,
                    request.user,
                )

                # Approve the file
                media_file = pending_file.approve_and_create_media_file(
                    title=approval_data["title"],
                    slug=approval_data.get("slug"),
                    description=approval_data.get("description", ""),
                    tags=tag_ids,
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
