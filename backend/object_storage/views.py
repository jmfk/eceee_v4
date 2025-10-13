"""
Object Storage System API Views

Provides REST API endpoints for managing object types and instances.
"""

from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import uuid
import os
import re
import logging

# Set up logger
logger = logging.getLogger(__name__)

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
    filterset_fields = ["is_active", "hierarchy_level"]

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
        # Show types that can appear at top level: 'top_level_only' and 'both'
        queryset = self.get_queryset().filter(
            is_active=True, hierarchy_level__in=["top_level_only", "both"]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def schema(self, request, pk=None):
        """Get the schema for an object type"""
        obj_type = self.get_object()
        return Response(
            {
                "schema": obj_type.schema,
                "properties": obj_type.schema.get("properties", {}),
            }
        )

    @action(detail=True, methods=["put"])
    def update_basic_info(self, request, pk=None):
        """Update basic information for an object type"""
        obj_type = self.get_object()

        # Define allowed basic info fields
        allowed_fields = [
            "name",
            "label",
            "plural_label",
            "description",
            "is_active",
            "hierarchy_level",
        ]

        # Filter request data to only include basic info fields
        basic_info_data = {}
        for field in allowed_fields:
            if field in request.data:
                basic_info_data[field] = request.data[field]

        if not basic_info_data:
            return Response(
                {"error": "No valid basic info fields provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            serializer = self.get_serializer(
                obj_type, data=basic_info_data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

            return Response(
                {
                    "message": "Basic info updated successfully",
                    "name": serializer.data.get("name"),
                    "label": serializer.data.get("label"),
                    "updated_at": serializer.data.get("updated_at"),
                },
                status=status.HTTP_200_OK,
            )

        except ValidationError as e:
            logger.warning(f"Validation error updating basic info: {str(e)}")
            return Response(
                {"error": "Invalid data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Unexpected error updating basic info: {str(e)}", exc_info=True
            )
            return Response(
                {"error": "Failed to update basic info due to server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["put"])
    def update_slots(self, request, pk=None):
        """Update widget slots configuration for an object type"""
        obj_type = self.get_object()

        # Validate that request.data contains a valid slot configuration
        if not isinstance(request.data, dict) or "slots" not in request.data:
            return Response(
                {
                    "error": "Invalid slot configuration format. Expected object with 'slots' array."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate that slots is an array
        if not isinstance(request.data["slots"], list):
            return Response(
                {"error": "Invalid slot configuration. 'slots' must be an array."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each slot has required fields
        for i, slot in enumerate(request.data["slots"]):
            if not isinstance(slot, dict):
                return Response(
                    {"error": f"Slot {i + 1} must be an object"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not slot.get("name") or not slot["name"].strip():
                return Response(
                    {"error": f"Slot {i + 1}: Slot Name is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not slot.get("label") or not slot["label"].strip():
                return Response(
                    {"error": f"Slot {i + 1}: Display Label is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Check for duplicate slot names
        slot_names = [
            slot["name"] for slot in request.data["slots"] if slot.get("name")
        ]
        if len(slot_names) != len(set(slot_names)):
            return Response(
                {"error": "Duplicate slot names are not allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Wrap the slots in slot_configuration object
            slot_config_data = {"slot_configuration": request.data}

            serializer = self.get_serializer(
                obj_type, data=slot_config_data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Collect any warnings from validation
            warnings = getattr(serializer, "_slot_warnings", [])

            response_data = {
                "message": "Widget slots updated successfully",
                "slotConfiguration": serializer.data.get("slot_configuration"),
                "updated_at": serializer.data.get("updated_at"),
            }

            if warnings:
                response_data["warnings"] = warnings
                response_data["message"] = (
                    f"Widget slots updated with {len(warnings)} warning(s)"
                )

            return Response(response_data, status=status.HTTP_200_OK)

        except ValidationError as e:
            logger.warning(f"Validation error updating widget slots: {str(e)}")
            return Response(
                {"error": "Invalid slot configuration provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Unexpected error updating widget slots: {str(e)}", exc_info=True
            )
            return Response(
                {"error": "Failed to update widget slots due to server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["put"])
    def update_schema(self, request, pk=None):
        """Update the schema for an object type"""
        obj_type = self.get_object()

        # Validate that request.data contains a valid schema
        if not isinstance(request.data, dict) or "properties" not in request.data:
            return Response(
                {
                    "error": "Invalid schema format. Expected schema object with 'properties' object."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate that properties is an object
        if not isinstance(request.data["properties"], dict):
            return Response(
                {"error": "Invalid schema format. 'properties' must be an object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            serializer = self.get_serializer(
                obj_type, data={"schema": request.data}, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

            return Response(
                {
                    "message": "Schema updated successfully",
                    "schema": serializer.data.get("schema"),
                    "updated_at": serializer.data.get("updated_at"),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to update schema: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["put"])
    def update_relationships(self, request, pk=None):
        """Update relationships configuration for an object type"""
        obj_type = self.get_object()

        try:
            # Extract relationships data
            hierarchy_level = request.data.get("hierarchy_level")
            allowed_child_types = request.data.get("allowed_child_types", [])

            # Validate hierarchy level
            if hierarchy_level and hierarchy_level not in [
                "top_level_only",
                "sub_object_only",
                "both",
            ]:
                return Response(
                    {
                        "error": "Invalid hierarchy level. Must be 'top_level_only', 'sub_object_only', or 'both'"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Update hierarchy level if provided
            if hierarchy_level is not None:
                obj_type.hierarchy_level = hierarchy_level

            # Update allowed child types if provided
            if allowed_child_types is not None:
                # Validate that all child type names exist and are active
                if allowed_child_types:
                    existing_types = ObjectTypeDefinition.objects.filter(
                        name__in=allowed_child_types, is_active=True
                    ).values_list("name", flat=True)

                    invalid_names = set(allowed_child_types) - set(existing_types)
                    if invalid_names:
                        return Response(
                            {
                                "error": f"Invalid child types: {', '.join(invalid_names)}"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                # Get the ObjectTypeDefinition instances
                child_types = (
                    ObjectTypeDefinition.objects.filter(
                        name__in=allowed_child_types, is_active=True
                    )
                    if allowed_child_types
                    else []
                )

                # Update the allowed child types
                obj_type.allowed_child_types.set(child_types)

            # Save the object type
            obj_type.save()

            # Return updated data
            serializer = self.get_serializer(obj_type)
            return Response(
                {
                    "message": "Relationships updated successfully",
                    "hierarchy_level": obj_type.hierarchy_level,
                    "allowed_child_types": [
                        ct.name for ct in obj_type.allowed_child_types.all()
                    ],
                    "updated_at": serializer.data.get("updated_at"),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to update relationships: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    @action(
        detail=True,
        methods=["get"],
        url_path="slots/(?P<slot_name>[^/.]+)/allowed-widgets",
    )
    def get_allowed_widgets_for_slot(self, request, pk=None, slot_name=None):
        """Get allowed widget types for a specific slot"""
        obj_type = self.get_object()

        try:
            allowed_widgets = obj_type.get_allowed_widgets_for_slot(slot_name)

            # Convert to serializable format
            widgets_data = []
            for widget in allowed_widgets:
                widgets_data.append(
                    {
                        "name": widget.name,
                        "type": widget.type,
                        "description": widget.description,
                        "template_name": widget.template_name,
                        "is_active": widget.is_active,
                        "has_configuration_model": hasattr(
                            widget, "configuration_model"
                        ),
                    }
                )

            return Response(
                {
                    "slot_name": slot_name,
                    "allowed_widgets": widgets_data,
                    "slot_config": obj_type.get_slot_configuration(slot_name),
                }
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to get allowed widgets: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"])
    def available_widgets(self, request):
        """Get all available widget types for slot configuration"""
        from webpages.widget_registry import widget_type_registry

        try:
            all_widgets = widget_type_registry.list_widget_types()

            widgets_data = []
            for widget in all_widgets:
                widgets_data.append(
                    {
                        "name": widget.name,
                        "type": widget.type,
                        "description": widget.description,
                        "template_name": widget.template_name,
                        "is_active": widget.is_active,
                        "has_configuration_model": hasattr(
                            widget, "configuration_model"
                        ),
                    }
                )

            return Response({"widgets": widgets_data, "count": len(widgets_data)})

        except Exception as e:
            return Response(
                {"error": f"Failed to get available widgets: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ObjectInstanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Instances"""

    queryset = ObjectInstance.objects.select_related(
        "object_type", "created_by", "parent", "current_version"
    ).prefetch_related("versions")
    serializer_class = ObjectInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "slug", "current_version__data"]
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
        """Publish the latest version of an object instance"""
        instance = self.get_object()

        # Get or create latest version
        latest_version = instance.get_latest_version()
        if not latest_version:
            # Create a version if none exists
            latest_version = instance.create_version(
                request.user, change_description="Published via API"
            )

        # Set effective_date to now to publish immediately
        effective_date = request.data.get("effective_date", timezone.now())
        expiry_date = request.data.get("expiry_date")
        is_featured = request.data.get("is_featured", False)

        latest_version.effective_date = effective_date
        latest_version.expiry_date = expiry_date
        latest_version.is_featured = is_featured
        latest_version.save(
            update_fields=["effective_date", "expiry_date", "is_featured"]
        )

        # Update current_version pointer
        instance.current_version = latest_version
        instance.save(update_fields=["current_version"])

        serializer = self.get_serializer(instance)
        return Response(
            {
                "message": "Object published successfully",
                "object": serializer.data,
            }
        )

    @action(detail=True, methods=["get"])
    def current_published_version(self, request, pk=None):
        """Get the current published version of this object"""
        instance = self.get_object()
        current_version = instance.get_current_published_version()

        if not current_version:
            # Return 200 with null data instead of 404
            return Response({"data": None})

        from .serializers import ObjectVersionSerializer

        serializer = ObjectVersionSerializer(current_version)
        return Response({"data": serializer.data})

    @action(detail=True, methods=["put", "patch"])
    def update_current_version(self, request, pk=None):
        """Update the current version without creating a new version"""
        instance = self.get_object()

        # Extract data and widgets from request
        data = request.data.get("data")
        widgets = request.data.get("widgets")
        change_description = request.data.get(
            "change_description", "Updated current version via API"
        )

        # Extract other object fields that can be updated
        title = request.data.get("title")
        status = request.data.get("status")
        parent = request.data.get("parent")
        metadata = request.data.get("metadata")
        publish_date = request.data.get("publish_date")
        unpublish_date = request.data.get("unpublish_date")

        # Check if we have at least one field to update
        has_version_changes = data is not None or widgets is not None
        has_object_changes = any(
            [
                title is not None,
                status is not None,
                parent is not None,
                metadata is not None,
                publish_date is not None,
                unpublish_date is not None,
            ]
        )

        if not has_version_changes and not has_object_changes:
            return Response(
                {"error": "At least one field must be provided for update"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Update object fields first
            object_updated = False
            if has_object_changes:
                if title is not None:
                    instance.title = title
                    object_updated = True
                if status is not None:
                    instance.status = status
                    object_updated = True
                if parent is not None:
                    # Handle parent field (can be ID or None)
                    if parent:
                        try:
                            parent_obj = ObjectInstance.objects.get(pk=parent)
                            instance.parent = parent_obj
                        except ObjectInstance.DoesNotExist:
                            return Response(
                                {
                                    "error": f"Parent object with ID {parent} does not exist"
                                },
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                    else:
                        instance.parent = None
                    object_updated = True
                if metadata is not None:
                    instance.metadata = metadata
                    object_updated = True
                if publish_date is not None:
                    instance.publish_date = publish_date
                    object_updated = True
                if unpublish_date is not None:
                    instance.unpublish_date = unpublish_date
                    object_updated = True

                if object_updated:
                    instance.save()

            # Update the current version if data or widgets changed
            updated_version = None
            if has_version_changes:
                updated_version = instance.update_current_version(
                    request.user,
                    data=data,
                    widgets=widgets,
                    change_description=change_description,
                )

            # Return the updated instance data
            serializer = self.get_serializer(instance)
            response_data = {
                "message": "Object updated successfully",
                "object": serializer.data,
            }

            if updated_version:
                response_data.update(
                    {
                        "version_id": updated_version.id,
                        "version_number": updated_version.version_number,
                    }
                )

            return Response(response_data)

        except Exception as e:
            return Response(
                {"error": f"Failed to update object: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["put", "patch"])
    def update_widgets(self, request, pk=None):
        """Update only the widgets for an object instance"""
        instance = self.get_object()

        # Extract widgets from request
        new_widgets = request.data.get("widgets")
        if new_widgets is None:
            return Response(
                {"error": "No widgets data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Validate widgets against slots
            serializer = self.get_serializer()
            serializer._validate_widgets_against_slots(
                new_widgets, instance.object_type
            )

            # Update current version with only widgets
            updated_version = instance.update_current_version(
                user=request.user,
                widgets=new_widgets,
                change_description=request.data.get(
                    "change_description", "Widget update"
                ),
            )

            return Response(
                {
                    "message": "Widgets updated successfully",
                    "widgets": updated_version.widgets,
                    "version_id": updated_version.id,
                    "updated_at": updated_version.updated_at,
                }
            )

        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Failed to update widgets: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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
                change_description=f"Moved to new parent: {new_parent.title if new_parent else 'root'}",
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
        status_filter = request.query_params.get("status")

        roots = self.get_queryset().filter(parent__isnull=True)

        if object_type:
            try:
                obj_type = ObjectTypeDefinition.objects.get(name=object_type)
                roots = roots.filter(object_type=obj_type)
            except ObjectTypeDefinition.DoesNotExist:
                return Response(
                    {"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND
                )

        # Filter by status
        if status_filter and status_filter != "all":
            roots = roots.filter(status=status_filter)

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
                | Q(current_version__data__icontains=query)
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

        # Filter by published status (using version-based logic)
        published_only = (
            request.query_params.get("published_only", "").lower() == "true"
        )
        if published_only:
            now = timezone.now()
            # Use version-based publishing logic
            from django.db.models import Exists, OuterRef
            from .models import ObjectVersion

            published_versions = ObjectVersion.objects.filter(
                object_instance=OuterRef("pk"), effective_date__lte=now
            ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

            instances = instances.filter(
                Exists(published_versions), current_version__isnull=False
            )

        # Order results by relevance
        if query:
            # Use database functions for better relevance scoring
            from django.db.models import Case, When, IntegerField

            instances = instances.annotate(
                relevance=Case(
                    When(title__icontains=query, then=3),
                    When(slug__icontains=query, then=2),
                    When(current_version__data__icontains=query, then=1),
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
        """Get only published objects using version-based logic"""
        now = timezone.now()

        # Use the published manager to get objects with published versions
        published_instances = ObjectInstance.published.published_only(
            now
        ).select_related("object_type", "current_version", "created_by")

        serializer = self.get_serializer(published_instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def news_list(self, request):
        """
        Get a mixed list of objects from multiple object types.
        Query params:
        - object_types: comma-separated list of object type IDs
        - limit: maximum number of items (default 10, max 50)
        - sort_order: field to sort by (default: -publish_date)
        """
        # Parse object_types parameter
        object_types_param = request.query_params.get("object_types", "")
        if not object_types_param:
            return Response(
                {"error": "object_types parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            object_type_ids = [
                int(id.strip()) for id in object_types_param.split(",") if id.strip()
            ]
        except ValueError:
            return Response(
                {
                    "error": "Invalid object_types format. Expected comma-separated integers."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not object_type_ids:
            return Response(
                {"error": "At least one object type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse limit parameter
        limit = request.query_params.get("limit", "10")
        try:
            limit = int(limit)
            if limit < 1 or limit > 50:
                limit = 10
        except ValueError:
            limit = 10

        # Parse sort_order parameter
        sort_order = request.query_params.get("sort_order", "-publish_date")
        valid_sort_fields = [
            "publish_date",
            "-publish_date",
            "created_at",
            "-created_at",
            "title",
            "-title",
            "updated_at",
            "-updated_at",
        ]
        if sort_order not in valid_sort_fields:
            sort_order = "-publish_date"

        # Use the model method to get published news items
        # This handles version-based publishing and featured status from ObjectVersion.is_featured
        instances = ObjectInstance.get_published_objects(
            object_type_ids=object_type_ids,
            limit=limit,
            sort_order=sort_order,
            prioritize_featured=True,
        )

        # Serialize and return
        serializer = self.get_serializer(instances, many=True)
        return Response(
            {
                "results": serializer.data,
                "count": len(serializer.data),
                "limit": limit,
                "sort_order": sort_order,
                "object_types": object_type_ids,
            }
        )

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
                        obj.create_version(
                            request.user, change_description="Bulk published via API"
                        )
                        results.append({"id": obj.id, "status": "published"})

                    elif operation == "unpublish":
                        obj.status = "draft"
                        obj.save()
                        obj.create_version(
                            request.user, change_description="Bulk unpublished via API"
                        )
                        results.append({"id": obj.id, "status": "unpublished"})

                    elif operation == "delete":
                        obj_id = obj.id
                        obj.delete()
                        results.append({"id": obj_id, "status": "deleted"})

                    elif operation == "archive":
                        obj.status = "archived"
                        obj.save()
                        obj.create_version(
                            request.user, change_description="Bulk archived via API"
                        )
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
        "object_instance", "object_instance__object_type", "created_by"
    )
    serializer_class = ObjectVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["version_number", "created_at"]
    ordering = ["-version_number"]
    filterset_fields = ["object_instance", "object_instance__object_type"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectVersionListSerializer
        return ObjectVersionSerializer

    def partial_update(self, request, pk=None):
        """Allow updating specific version fields (e.g., is_featured)"""
        version = self.get_object()

        # Only allow updating specific fields
        allowed_fields = ["is_featured", "change_description"]

        for field, value in request.data.items():
            if field in allowed_fields:
                setattr(version, field, value)

        version.save(update_fields=[f for f in allowed_fields if f in request.data])

        serializer = self.get_serializer(version)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish this version immediately"""
        version = self.get_object()

        # Accept is_featured parameter
        is_featured = request.data.get("is_featured", version.is_featured)

        # Set effective_date to now to publish immediately
        version.effective_date = timezone.now()
        version.is_featured = is_featured
        # Don't change expiry_date - let it remain as is
        version.save(update_fields=["effective_date", "is_featured"])

        # Update the object's current_version pointer to this version if it's the latest published
        current_published = version.object_instance.get_current_published_version()
        if current_published and current_published.id == version.id:
            version.object_instance.current_version = version
            version.object_instance.save(update_fields=["current_version"])

        serializer = self.get_serializer(version)
        return Response(
            {
                "message": "Version published successfully",
                "version": serializer.data,
            }
        )

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        """Schedule this version for future publication"""
        version = self.get_object()

        effective_date = request.data.get("effective_date")
        expiry_date = request.data.get("expiry_date")
        is_featured = request.data.get("is_featured", version.is_featured)

        if not effective_date:
            return Response(
                {"error": "effective_date is required for scheduling"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from dateutil.parser import parse

            version.effective_date = parse(effective_date)
            if expiry_date:
                version.expiry_date = parse(expiry_date)
            version.is_featured = is_featured
            version.save(update_fields=["effective_date", "expiry_date", "is_featured"])
        except (ValueError, TypeError) as e:
            return Response(
                {"error": f"Invalid date format: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(version)
        return Response(
            {
                "message": "Version scheduled successfully",
                "version": serializer.data,
            }
        )

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish this version by removing its effective_date"""
        version = self.get_object()

        version.effective_date = None
        version.expiry_date = None
        version.save(update_fields=["effective_date", "expiry_date"])

        # Update the object's current_version pointer if needed
        current_published = version.object_instance.get_current_published_version()
        version.object_instance.current_version = current_published
        version.object_instance.save(update_fields=["current_version"])

        serializer = self.get_serializer(version)
        return Response(
            {
                "message": "Version unpublished successfully",
                "version": serializer.data,
            }
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def upload_image(request):
    """
    Upload an image file and optionally save it directly to an object type.

    If object_type_id is provided, the image will be saved directly to that object type.
    Otherwise, returns the URL for manual handling.
    """
    if "image" not in request.FILES:
        return Response(
            {"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST
        )

    image_file = request.FILES["image"]
    object_type_id = request.data.get("object_type_id")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if image_file.content_type not in allowed_types:
        return Response(
            {"error": f'Invalid file type. Allowed types: {", ".join(allowed_types)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate file size (5MB max)
    max_size = 5 * 1024 * 1024  # 5MB
    if image_file.size > max_size:
        return Response(
            {"error": "File too large. Maximum size is 5MB"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # If object_type_id is provided, validate it exists
    object_type = None
    if object_type_id:
        try:
            object_type = ObjectTypeDefinition.objects.get(id=object_type_id)
        except ObjectTypeDefinition.DoesNotExist:
            return Response(
                {"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND
            )

    try:
        # Sanitize and validate file extension
        file_extension = os.path.splitext(image_file.name)[1].lower()

        # Whitelist allowed extensions
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
        if file_extension not in allowed_extensions:
            return Response(
                {
                    "error": f"Invalid file extension. Allowed: {', '.join(allowed_extensions)}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Sanitize extension to prevent path traversal
        safe_extension = re.sub(r"[^a-zA-Z0-9.]", "", file_extension)
        unique_filename = f"object_type_icons/{uuid.uuid4()}{safe_extension}"

        # Save the file
        file_path = default_storage.save(
            unique_filename, ContentFile(image_file.read())
        )

        # Get the full URL
        file_url = default_storage.url(file_path)

        # If object_type_id was provided, save the image to the object type
        if object_type:
            # Remove old image if it exists
            if object_type.icon_image:
                try:
                    default_storage.delete(object_type.icon_image.name)
                except:
                    pass  # Ignore errors when deleting old image

            # Save the new image path to the object type
            object_type.icon_image.name = file_path
            object_type.save(update_fields=["icon_image"])

        return Response(
            {
                "url": file_url,
                "filename": image_file.name,
                "size": image_file.size,
                "content_type": image_file.content_type,
                "object_type_updated": bool(object_type),
            },
            status=status.HTTP_201_CREATED,
        )

    except ValidationError as e:
        logger.warning(f"File upload validation error: {str(e)}")
        return Response(
            {"error": "Invalid file format or content"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except PermissionError as e:
        logger.error(f"File upload permission error: {str(e)}")
        return Response(
            {"error": "Permission denied for file upload"},
            status=status.HTTP_403_FORBIDDEN,
        )
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {str(e)}", exc_info=True)
        return Response(
            {"error": "Upload failed due to server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
