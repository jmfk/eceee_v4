"""
ViewSet for managing pending media files awaiting approval.
"""

import logging

from django.db import transaction
from django.db.models import Q
from django.http import Http404, HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..models import MediaCollection, MediaFile, PendingMediaFile
from ..security import pending_preview_token_is_valid
from ..serializers import (
    BulkApprovalSerializer,
    MediaFileApprovalSerializer,
    MediaFileDetailSerializer,
    PendingMediaFileDetailSerializer,
    PendingMediaFileListSerializer,
)
from ..storage import storage

logger = logging.getLogger(__name__)


def _can_access_theme_pending(pending_file, user, tenant=None):
    """Keep pending theme uploads inside their tenant's Designer boundary."""
    from ..security import user_can_access_namespace

    if tenant is not None and tenant.pk != pending_file.namespace.tenant_id:
        return False
    if not pending_file.namespace.is_hidden:
        return True
    return user_can_access_namespace(user, pending_file.namespace)


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

            tenant = getattr(self.request, "tenant", None)
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
                # If namespace slug doesn't exist, return empty queryset
                queryset = queryset.none()

        # For preview action, don't filter by user (anonymous access allowed)
        # Just return the base queryset without user filtering
        if self.action == "preview":
            return queryset

        from content.models import Namespace
        from core.permissions import user_can_switch_tenant

        tenant = getattr(self.request, "tenant", None)
        if tenant is not None:
            queryset = queryset.filter(namespace__tenant=tenant)
        theme_media = Q(namespace__is_hidden=True)
        if user_can_switch_tenant(self.request.user):
            allowed_theme_media = theme_media
        else:
            allowed_theme_media = theme_media & (
                Q(namespace__tenant__created_by=self.request.user)
                | Q(namespace__tenant__members=self.request.user)
                | Q(namespace__tenant__theme_designer_assignments__user=self.request.user)
            )
        if tenant is not None:
            allowed_theme_media &= Q(namespace__tenant=tenant)
        queryset = queryset.filter(~theme_media | allowed_theme_media).distinct()

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

        Public endpoint since <img> tags can't send auth headers. Theme-media
        previews additionally require the signed capability URL returned by the
        authenticated pending-file APIs.
        """
        try:
            pending_file = self.get_object()
        except PendingMediaFile.DoesNotExist:
            raise Http404("Pending file not found")

        if pending_file.namespace.is_hidden and not pending_preview_token_is_valid(
            pending_file, request.query_params.get("preview_token")
        ):
            raise Http404("Pending file not found")

        # For images, serve the actual file
        if pending_file.file_type == "image":
            try:
                # Get file from storage
                file_content = storage.get_file_content(pending_file.file_path)

                response = HttpResponse(file_content, content_type=pending_file.content_type)
                response["Content-Disposition"] = f'inline; filename="{pending_file.original_filename}"'
                return response

            except Exception as e:
                logger.error(f"Error serving pending file preview: {str(e)}", exc_info=True)
                return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response(
                {"error": "Preview not available for this file type"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    @transaction.atomic
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
            from content.models import Namespace
            from taxonomy.assignments import classification_ids, replace_assignments, validate_media_selection

            from ..security import MediaFilePermission

            Namespace.objects.select_for_update().get(pk=pending_file.namespace_id)
            existing_file = MediaFile.objects.select_for_update().get(pk=existing_file.pk)
            if not MediaFilePermission().has_object_permission(request, self, existing_file):
                raise PermissionDenied("You cannot update this existing media file.")
            # Get new tags from the approval data
            if "classification_ids" in request.data:
                new_ids = validate_media_selection(
                    existing_file.namespace, request.user, request.data["classification_ids"]
                )
                replace_assignments(
                    existing_file, list(dict.fromkeys([*classification_ids(existing_file), *new_ids])), request.user
                )
            new_tag_ids = request.data.get("tag_ids", []) if "classification_ids" not in request.data else []
            if new_tag_ids:
                from ..serializers import convert_tag_names_to_ids

                validated_tag_ids = convert_tag_names_to_ids(
                    new_tag_ids,
                    pending_file.namespace,
                    request.user,
                )
                existing_file.tags.add(*validated_tag_ids)

            if not classification_ids(existing_file):
                raise ValidationError({"classification_ids": "At least one approved taxonomy term is required."})

            # Handle annotation update if provided
            annotation = request.data.get("annotation")
            if annotation:
                existing_file.metadata = existing_file.metadata or {}
                existing_file.metadata["annotation"] = annotation

            existing_file.save()

            # Handle collection assignment if requested
            collection_id = request.data.get("collection_id")
            collection_name = request.data.get("collection_name")

            if collection_id or collection_name:
                collection = self._get_or_create_collection(
                    collection_id,
                    collection_name,
                    pending_file.namespace,
                    request.user,
                    classification_ids=classification_ids(existing_file),
                )
                existing_file.collections.add(collection)

            # Mark pending file as approved
            pending_file.status = "approved"
            pending_file.save()

            # Ensure existing file has the correct tenant if it's missing
            if not existing_file.tenant_id:
                existing_file.tenant = pending_file.namespace.tenant
                existing_file.save(update_fields=["tenant"])

            # Ensure existing file has uploaded_by if it's missing
            if not existing_file.uploaded_by_id:
                existing_file.uploaded_by = pending_file.uploaded_by
                existing_file.save(update_fields=["uploaded_by"])

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
            # Validate/create the requested collection before hash cleanup or
            # approval. A collection failure must leave the upload pending.
            collection_id = serializer.validated_data.get("collection_id")
            collection_name = serializer.validated_data.get("collection_name")
            collection = None
            if collection_id or collection_name:
                from taxonomy.projections import legacy_media_ids

                selected_ids = serializer.validated_data.get("classification_ids")
                if selected_ids is None:
                    selected_ids = legacy_media_ids(
                        pending_file, serializer.validated_data.get("tag_ids", []), request.user
                    )
                collection = self._get_or_create_collection(
                    collection_id,
                    collection_name,
                    pending_file.namespace,
                    request.user,
                    classification_ids=selected_ids,
                )
            # Create the approved media file
            media_file = pending_file.approve_and_create_media_file(
                title=serializer.validated_data["title"],
                slug=serializer.validated_data.get("slug"),
                description=serializer.validated_data.get("description", ""),
                annotation=serializer.validated_data.get("annotation", ""),
                tags=serializer.validated_data.get("tag_ids", []),
                classification_ids=serializer.validated_data.get("classification_ids"),
                user=request.user,
                access_level=serializer.validated_data.get("access_level", "public"),
            )

            # Handle collection assignment
            if collection:
                media_file.collections.add(collection)

            # Return the created media file
            media_serializer = MediaFileDetailSerializer(media_file)
            return Response(
                {"status": "approved", "media_file": media_serializer.data},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            transaction.set_rollback(True)
            return Response(
                {"error": f"Failed to approve file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @transaction.atomic
    def _get_or_create_collection(self, collection_id, collection_name, namespace, user, *, classification_ids):
        """Get existing collection or create new one."""
        if collection_id:
            try:
                return MediaCollection.objects.get(id=collection_id, namespace=namespace)
            except MediaCollection.DoesNotExist:
                raise ValidationError({"collection_id": "Collection is unavailable in this namespace."})
        elif collection_name:
            # Approval treats collection assignment as optional. Roll back the whole
            # collection attempt if its classifications cannot be copied from the file.
            collection, created = MediaCollection.objects.get_or_create(
                title=collection_name,
                namespace=namespace,
                defaults={
                    "created_by": user,
                    "last_modified_by": user,
                    "access_level": "public",
                },
            )
            if created:
                from taxonomy.assignments import replace_assignments

                replace_assignments(collection, classification_ids, user)
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
                pending_files = PendingMediaFile.objects.filter(
                    id=approval_data["pending_file_id"],
                    status="pending",
                )
                tenant = getattr(request, "tenant", None)
                if tenant is not None:
                    pending_files = pending_files.filter(namespace__tenant=tenant)
                pending_file = pending_files.get()

                # Check permissions
                if not _can_access_theme_pending(pending_file, request.user, getattr(request, "tenant", None)):
                    results.append(
                        {
                            "pending_file_id": approval_data["pending_file_id"],
                            "status": "error",
                            "error": "Permission denied",
                        }
                    )
                    continue
                if not request.user.is_staff and pending_file.uploaded_by != request.user:
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
                    approval_data.get("tag_ids", []) if "classification_ids" not in approval_data else [],
                    pending_file.namespace,
                    request.user,
                )

                # Approve the file
                media_file = pending_file.approve_and_create_media_file(
                    title=approval_data["title"],
                    slug=approval_data.get("slug"),
                    description=approval_data.get("description", ""),
                    annotation=approval_data.get("annotation", ""),
                    tags=tag_ids,
                    classification_ids=approval_data.get("classification_ids"),
                    user=request.user,
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
            return Response({"error": "No file IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        results = []

        for file_id in file_ids:
            try:
                pending_files = PendingMediaFile.objects.filter(id=file_id, status="pending")
                tenant = getattr(request, "tenant", None)
                if tenant is not None:
                    pending_files = pending_files.filter(namespace__tenant=tenant)
                pending_file = pending_files.get()

                # Check permissions
                if not _can_access_theme_pending(pending_file, request.user, getattr(request, "tenant", None)):
                    results.append(
                        {
                            "file_id": file_id,
                            "status": "error",
                            "error": "Permission denied",
                        }
                    )
                    continue
                if not request.user.is_staff and pending_file.uploaded_by != request.user:
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
