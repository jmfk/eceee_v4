"""
Object Storage System API Views

Provides REST API endpoints for managing object types and instances.
"""

from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count
from django.utils import timezone

from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion
from .serializers import (
    ObjectTypeDefinitionSerializer,
    ObjectTypeDefinitionListSerializer,
    ObjectInstanceSerializer,
    ObjectInstanceListSerializer,
    ObjectVersionSerializer,
    ObjectVersionListSerializer,
)


class ObjectTypeDefinitionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Type Definitions"""

    queryset = ObjectTypeDefinition.objects.select_related(
        "created_by"
    ).prefetch_related("allowed_child_types")
    serializer_class = ObjectTypeDefinitionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "label", "plural_label", "description"]
    ordering_fields = ["name", "label", "created_at", "updated_at"]
    ordering = ["label"]
    filterset_fields = ["is_active", "show_in_main_browser"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectTypeDefinitionListSerializer
        return ObjectTypeDefinitionSerializer

    def perform_create(self, serializer):
        """Set the created_by field when creating"""
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def main_browser_types(self, request):
        """Get object types that should appear in the main browser grid"""
        queryset = self.get_queryset().filter(is_active=True, show_in_main_browser=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def schema(self, request, pk=None):
        """Get the schema for an object type"""
        obj_type = self.get_object()
        return Response(
            {"schema": obj_type.schema, "fields": obj_type.get_schema_fields()}
        )

    @action(detail=True, methods=["put"])
    def update_schema(self, request, pk=None):
        """Update the schema for an object type"""
        obj_type = self.get_object()
        serializer = self.get_serializer(
            obj_type, data={"schema": request.data}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def instances(self, request, pk=None):
        """Get all instances of this object type"""
        obj_type = self.get_object()
        instances = ObjectInstance.objects.filter(object_type=obj_type).select_related(
            "created_by", "parent"
        )

        # Apply filters
        status_filter = request.query_params.get("status")
        if status_filter:
            instances = instances.filter(status=status_filter)

        serializer = ObjectInstanceListSerializer(instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active object types"""
        active_types = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(active_types, many=True)
        return Response(serializer.data)


class ObjectInstanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Instances"""

    queryset = ObjectInstance.objects.select_related(
        "object_type", "created_by", "parent"
    ).prefetch_related("versions")
    serializer_class = ObjectInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "slug", "data"]
    ordering_fields = ["title", "created_at", "updated_at", "publish_date"]
    ordering = ["-created_at"]
    filterset_fields = ["object_type", "status", "parent", "level"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectInstanceListSerializer
        return ObjectInstanceSerializer

    def perform_create(self, serializer):
        """Set the created_by field when creating"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish an object instance"""
        instance = self.get_object()

        publish_date = request.data.get("publish_date")
        if publish_date:
            instance.publish_date = publish_date

        instance.status = "published"
        instance.save()

        # Create version for publishing
        instance.create_version(request.user, "Published via API")

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        """Get version history for an object instance"""
        instance = self.get_object()
        versions = instance.versions.select_related("created_by")
        serializer = ObjectVersionListSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def children(self, request, pk=None):
        """Get direct child objects of this instance"""
        instance = self.get_object()
        children = instance.get_children().select_related("object_type", "created_by")
        serializer = ObjectInstanceListSerializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def descendants(self, request, pk=None):
        """Get all descendant objects (children, grandchildren, etc.)"""
        instance = self.get_object()
        descendants = instance.get_descendants().select_related(
            "object_type", "created_by"
        )
        serializer = ObjectInstanceListSerializer(descendants, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def ancestors(self, request, pk=None):
        """Get all ancestor objects (parent, grandparent, etc.)"""
        instance = self.get_object()
        ancestors = instance.get_ancestors().select_related("object_type", "created_by")
        serializer = ObjectInstanceListSerializer(ancestors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def siblings(self, request, pk=None):
        """Get sibling objects (same parent)"""
        instance = self.get_object()
        siblings = instance.get_siblings().select_related("object_type", "created_by")
        serializer = ObjectInstanceListSerializer(siblings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def tree(self, request, pk=None):
        """Get the entire tree this object belongs to"""
        instance = self.get_object()
        tree_objects = instance.get_tree_objects().select_related(
            "object_type", "created_by"
        )
        serializer = ObjectInstanceListSerializer(tree_objects, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def path_to_root(self, request, pk=None):
        """Get the path from this object to the root"""
        instance = self.get_object()
        path = instance.get_path_to_root().select_related("object_type", "created_by")
        serializer = ObjectInstanceListSerializer(path, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def move_to(self, request, pk=None):
        """Move this object to a new parent"""
        instance = self.get_object()
        new_parent_id = request.data.get("new_parent_id")
        position = request.data.get(
            "position", "last-child"
        )  # first-child, last-child, left, right

        # Validate new parent
        new_parent = None
        if new_parent_id:
            try:
                new_parent = ObjectInstance.objects.get(id=new_parent_id)
            except ObjectInstance.DoesNotExist:
                return Response(
                    {"error": "New parent not found"}, status=status.HTTP_404_NOT_FOUND
                )

        # Check if move is allowed
        if not instance.can_move_to_parent(new_parent):
            return Response(
                {"error": "Cannot move to this parent"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Perform the move
        try:
            if position == "first-child":
                instance.move_to(new_parent, "first-child")
            elif position == "last-child":
                instance.move_to(new_parent, "last-child")
            elif position == "left":
                instance.move_to(new_parent, "left")
            elif position == "right":
                instance.move_to(new_parent, "right")
            else:
                instance.move_to(new_parent, "last-child")  # default

            # Create version for the move
            instance.create_version(
                request.user,
                f"Moved to new parent: {new_parent.title if new_parent else 'root'}",
            )

            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {"error": f"Move failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=["get"])
    def roots(self, request):
        """Get all root objects (objects without parents)"""
        object_type = request.query_params.get("type")

        roots = self.get_queryset().filter(parent__isnull=True)

        if object_type:
            try:
                obj_type = ObjectTypeDefinition.objects.get(name=object_type)
                roots = roots.filter(object_type=obj_type)
            except ObjectTypeDefinition.DoesNotExist:
                return Response(
                    {"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND
                )

        serializer = self.get_serializer(roots, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Advanced search across objects with multiple criteria"""
        query = request.query_params.get("q", "")

        # Start with all instances
        instances = self.get_queryset()

        # Text search across multiple fields
        if query:
            instances = instances.filter(
                Q(title__icontains=query)
                | Q(slug__icontains=query)
                | Q(data__icontains=query)
                | Q(object_type__label__icontains=query)
                | Q(object_type__name__icontains=query)
            )

        # Filter by object type
        object_type = request.query_params.get("type")
        if object_type:
            try:
                obj_type = ObjectTypeDefinition.objects.get(name=object_type)
                instances = instances.filter(object_type=obj_type)
            except ObjectTypeDefinition.DoesNotExist:
                return Response(
                    {"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND
                )

        # Filter by status
        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "all":
            instances = instances.filter(status=status_filter)

        # Filter by hierarchy level
        level = request.query_params.get("level")
        if level:
            try:
                instances = instances.filter(level=int(level))
            except ValueError:
                pass

        # Filter by published status
        published_only = (
            request.query_params.get("published_only", "").lower() == "true"
        )
        if published_only:
            now = timezone.now()
            instances = instances.filter(
                Q(status="published")
                & (Q(publish_date__isnull=True) | Q(publish_date__lte=now))
                & (Q(unpublish_date__isnull=True) | Q(unpublish_date__gt=now))
            )

        # Order results by relevance
        if query:
            # Use database functions for better relevance scoring
            from django.db.models import Case, When, IntegerField

            instances = instances.annotate(
                relevance=Case(
                    When(title__icontains=query, then=3),
                    When(slug__icontains=query, then=2),
                    When(data__icontains=query, then=1),
                    default=0,
                    output_field=IntegerField(),
                )
            ).order_by("-relevance", "-created_at")
        else:
            instances = instances.order_by("-created_at")

        # Apply pagination
        limit = request.query_params.get("limit", "20")
        try:
            limit = min(int(limit), 100)  # Max 100 results
            instances = instances[:limit]
        except ValueError:
            instances = instances[:20]

        serializer = self.get_serializer(instances, many=True)

        # Add search metadata
        return Response(
            {
                "results": serializer.data,
                "count": len(serializer.data),
                "query": query,
                "filters": {
                    "type": object_type,
                    "status": status_filter,
                    "level": level,
                    "published_only": published_only,
                },
            }
        )

    @action(detail=False, methods=["get"])
    def published(self, request):
        """Get only published objects"""
        now = timezone.now()
        published_instances = self.get_queryset().filter(
            Q(status="published")
            & (Q(publish_date__isnull=True) | Q(publish_date__lte=now))
            & (Q(unpublish_date__isnull=True) | Q(unpublish_date__gt=now))
        )

        serializer = self.get_serializer(published_instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="by-type/(?P<type_name>[^/.]+)")
    def by_type(self, request, type_name=None):
        """Get objects by type name"""
        try:
            obj_type = ObjectTypeDefinition.objects.get(name=type_name)
        except ObjectTypeDefinition.DoesNotExist:
            return Response(
                {"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND
            )

        instances = self.get_queryset().filter(object_type=obj_type)

        # Apply additional filters from query params
        status_filter = request.query_params.get("status")
        if status_filter:
            instances = instances.filter(status=status_filter)

        parent_id = request.query_params.get("parent")
        if parent_id:
            try:
                instances = instances.filter(parent_id=int(parent_id))
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid parent ID"}, status=status.HTTP_400_BAD_REQUEST
                )

        serializer = self.get_serializer(instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-operations")
    def bulk_operations(self, request):
        """Perform bulk operations on multiple objects"""
        operation = request.data.get("operation")
        object_ids = request.data.get("object_ids", [])

        if not operation:
            return Response(
                {"error": "Operation is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not object_ids:
            return Response(
                {"error": "Object IDs are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get objects that exist and user has permission for
        objects = self.get_queryset().filter(id__in=object_ids)

        if not objects.exists():
            return Response(
                {"error": "No valid objects found"}, status=status.HTTP_404_NOT_FOUND
            )

        results = []
        errors = []

        try:
            for obj in objects:
                try:
                    if operation == "publish":
                        obj.status = "published"
                        obj.save()
                        obj.create_version(request.user, "Bulk published via API")
                        results.append({"id": obj.id, "status": "published"})

                    elif operation == "unpublish":
                        obj.status = "draft"
                        obj.save()
                        obj.create_version(request.user, "Bulk unpublished via API")
                        results.append({"id": obj.id, "status": "unpublished"})

                    elif operation == "delete":
                        obj_id = obj.id
                        obj.delete()
                        results.append({"id": obj_id, "status": "deleted"})

                    elif operation == "archive":
                        obj.status = "archived"
                        obj.save()
                        obj.create_version(request.user, "Bulk archived via API")
                        results.append({"id": obj.id, "status": "archived"})

                    else:
                        errors.append(
                            {"id": obj.id, "error": f"Unknown operation: {operation}"}
                        )

                except Exception as e:
                    errors.append({"id": obj.id, "error": str(e)})

            return Response(
                {
                    "operation": operation,
                    "results": results,
                    "errors": errors,
                    "total_processed": len(results),
                    "total_errors": len(errors),
                }
            )

        except Exception as e:
            return Response(
                {"error": f"Bulk operation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ObjectVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing Object Versions (read-only)"""

    queryset = ObjectVersion.objects.select_related(
        "object", "object__object_type", "created_by"
    )
    serializer_class = ObjectVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["version_number", "created_at"]
    ordering = ["-version_number"]
    filterset_fields = ["object", "object__object_type"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectVersionListSerializer
        return ObjectVersionSerializer
