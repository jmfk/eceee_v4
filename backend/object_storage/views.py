"""
Object Storage System API Views

Provides REST API endpoints for managing object types and instances.
"""

import logging
import os
import re
import uuid

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from core.permissions import HasTenantAccess

from .models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from .serializers import (
    ObjectInstanceListSerializer,
    ObjectInstanceSerializer,
    ObjectTypeDefinitionListSerializer,
    ObjectTypeDefinitionSerializer,
    ObjectVersionListSerializer,
    ObjectVersionSerializer,
)

# Set up logger
logger = logging.getLogger(__name__)


def filter_publication_status(queryset, requested_status):
    """Filter the browser using live/scheduled versions rather than legacy status flags."""
    if not requested_status:
        return queryset
    if requested_status not in {"draft", "published", "scheduled"}:
        return queryset.filter(status=requested_status)
    now = timezone.now()
    live = ObjectVersion.objects.filter(object_instance_id=OuterRef("pk"), effective_date__lte=now).filter(
        Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
    )
    scheduled = ObjectVersion.objects.filter(object_instance_id=OuterRef("pk"), effective_date__gt=now)
    queryset = queryset.annotate(_has_live_version=Exists(live), _has_scheduled_version=Exists(scheduled))
    if requested_status == "published":
        return queryset.filter(_has_live_version=True)
    return queryset.filter(_has_live_version=False, _has_scheduled_version=requested_status == "scheduled")


class ObjectTypeDefinitionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Type Definitions"""

    queryset = ObjectTypeDefinition.objects.select_related("created_by", "browser_group").prefetch_related(
        "allowed_child_types"
    )
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

    def destroy(self, request, *args, **kwargs):
        """
        Delete an object type.
        Supports force_delete query parameter to delete even when instances exist.
        """
        instance = self.get_object()
        force_delete = request.query_params.get("force_delete", "false").lower() == "true"

        # Check for existing instances
        instance_count = ObjectInstance.objects.filter(object_type=instance).count()

        if instance_count > 0 and not force_delete:
            return Response(
                {
                    "error": f"Cannot delete object type: {instance_count} instance(s) exist",
                    "instance_count": instance_count,
                    "force_delete_required": True,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If force_delete, delete all instances first
        if force_delete and instance_count > 0:
            ObjectInstance.objects.filter(object_type=instance).delete()

        # Delete the object type
        instance.delete()

        return Response(
            {
                "message": "Object type deleted successfully",
                "instances_deleted": instance_count if force_delete else 0,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def main_browser_types(self, request):
        """Get object types that should appear in the main object browser."""
        # Show types that can appear at top level: 'top_level_only' and 'both'
        queryset = self.get_queryset().filter(is_active=True, hierarchy_level__in=["top_level_only", "both"])
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
            serializer = self.get_serializer(obj_type, data=basic_info_data, partial=True)
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
            logger.error(f"Unexpected error updating basic info: {str(e)}", exc_info=True)
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
                {"error": "Invalid slot configuration format. Expected object with 'slots' array."},
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
        slot_names = [slot["name"] for slot in request.data["slots"] if slot.get("name")]
        if len(slot_names) != len(set(slot_names)):
            return Response(
                {"error": "Duplicate slot names are not allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Wrap the slots in slot_configuration object
            slot_config_data = {"slot_configuration": request.data}

            serializer = self.get_serializer(obj_type, data=slot_config_data, partial=True)
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
                response_data["message"] = f"Widget slots updated with {len(warnings)} warning(s)"

            return Response(response_data, status=status.HTTP_200_OK)

        except ValidationError as e:
            logger.warning(f"Validation error updating widget slots: {str(e)}")
            return Response(
                {"error": "Invalid slot configuration provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Unexpected error updating widget slots: {str(e)}", exc_info=True)
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
                {"error": "Invalid schema format. Expected schema object with 'properties' object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate that properties is an object
        if not isinstance(request.data["properties"], dict):
            return Response(
                {"error": "Invalid schema format. 'properties' must be an object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            serializer = self.get_serializer(obj_type, data={"schema": request.data}, partial=True)
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
                    {"error": "Invalid hierarchy level. Must be 'top_level_only', 'sub_object_only', or 'both'"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            relationship_data = {
                "allowed_child_types_input": allowed_child_types,
            }
            if hierarchy_level is not None:
                relationship_data["hierarchy_level"] = hierarchy_level
            if "browser_group_id" in request.data:
                relationship_data["browser_group_id"] = request.data.get("browser_group_id")

            serializer = self.get_serializer(obj_type, data=relationship_data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Return updated data
            serializer = self.get_serializer(obj_type)
            return Response(
                {
                    "message": "Relationships updated successfully",
                    "hierarchy_level": obj_type.hierarchy_level,
                    "allowed_child_types": [ct.name for ct in obj_type.allowed_child_types.all()],
                    "browser_group": serializer.data.get("browser_group"),
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
        instances = ObjectInstance.objects.filter(
            object_type=obj_type,
            tenant=getattr(request, "tenant", None),
        ).select_related("created_by", "parent")

        # Apply filters
        status_filter = request.query_params.get("status")
        if status_filter:
            instances = filter_publication_status(instances, status_filter)

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
                        "has_configuration_model": hasattr(widget, "configuration_model"),
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
                        "has_configuration_model": hasattr(widget, "configuration_model"),
                    }
                )

            return Response({"widgets": widgets_data, "count": len(widgets_data)})

        except Exception as e:
            return Response(
                {"error": f"Failed to get available widgets: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ObjectWorkflowInput(serializers.Serializer):
    expected_version_id = serializers.IntegerField(min_value=1)
    expected_revision = serializers.IntegerField(min_value=1)
    expected_parent_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    expected_metadata = serializers.DictField(required=False)
    source_version_id = serializers.IntegerField(min_value=1, required=False)
    effective_date = serializers.DateTimeField(required=False)
    expiry_date = serializers.DateTimeField(required=False, allow_null=True)
    is_featured = serializers.BooleanField(required=False)


def object_workflow_required():
    return Response(
        {"error": "object_workflow_required", "message": "Reload and use the Object working-copy workflow."},
        status=status.HTTP_410_GONE,
    )


class ObjectInstanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Instances"""

    queryset = ObjectInstance.objects.select_related(
        "object_type", "created_by", "parent", "current_version"
    ).prefetch_related("versions")
    serializer_class = ObjectInstanceSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "slug", "current_version__data"]
    ordering_fields = ["title", "created_at", "updated_at", "publish_date"]
    ordering = ["-created_at"]
    filterset_fields = ["object_type", "parent", "level"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectInstanceListSerializer
        return ObjectInstanceSerializer

    def get_queryset(self):
        """Filter queryset by tenant"""
        queryset = super().get_queryset()

        # Filter by tenant from middleware
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)

        return filter_publication_status(queryset, self.request.query_params.get("status"))

    def perform_create(self, serializer):
        """Set the created_by and tenant fields when creating"""
        # Get tenant from request (set by middleware)
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Tenant is required. Provide X-Tenant-ID header.")
        serializer.save(created_by=self.request.user, tenant=tenant)

    def update(self, request, *args, **kwargs):
        if {"data", "widgets", "title", "status", "publish_date", "unpublish_date", "object_type_id"}.intersection(
            request.data
        ):
            return object_workflow_required()
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def workflow(self, request, pk=None):
        from .services.version_workflow import ObjectVersionWorkflow

        return Response(ObjectVersionWorkflow(self.get_object(), request.user).payload())

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def save_working_copy(self, request, pk=None):
        from .services.version_workflow import ObjectVersionWorkflow, ObjectWorkflowConflict

        obj = self.get_object()
        tokens = ObjectWorkflowInput(data=request.data)
        tokens.is_valid(raise_exception=True)
        for field in ("title", "data", "widgets"):
            if field not in request.data:
                raise serializers.ValidationError({field: "A complete working copy is required."})
        allowed_fields = ("title", "data", "widgets", "parent", "metadata")
        content = {key: request.data[key] for key in allowed_fields if key in request.data}
        serializer = self.get_serializer(obj, data=content, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        for field, baseline in (("parent", "expected_parent_id"), ("metadata", "expected_metadata")):
            if field in validated and baseline not in tokens.validated_data:
                raise serializers.ValidationError({baseline: f"Required when changing {field}."})
        if not isinstance(validated.get("data"), dict) or not isinstance(validated.get("widgets"), dict):
            raise serializers.ValidationError("Object data and widgets must be JSON objects.")
        if validated.get("parent") and not validated["parent"].object_type.can_have_child_type(obj.object_type):
            raise serializers.ValidationError({"parent": "This parent does not allow this Object type."})
        service = ObjectVersionWorkflow(obj, request.user)
        version = service.save(
            version_id=tokens.validated_data["expected_version_id"],
            revision=tokens.validated_data["expected_revision"],
            content={
                **validated,
                **(
                    {"is_featured": tokens.validated_data["is_featured"]}
                    if "is_featured" in tokens.validated_data
                    else {}
                ),
            },
        )
        if "parent" in validated and service.obj.parent_id != tokens.validated_data["expected_parent_id"]:
            raise ObjectWorkflowConflict("The Object parent changed. Reload before trying again.")
        if "metadata" in validated and service.obj.metadata != tokens.validated_data["expected_metadata"]:
            raise ObjectWorkflowConflict("The Object metadata changed. Reload before trying again.")
        for field in ("parent", "metadata"):
            if field in validated:
                setattr(service.obj, field, validated[field])
        if any(field in validated for field in ("parent", "metadata")):
            service.obj.save()
        service.obj.refresh_from_db()
        return Response(
            {
                "object": self.get_serializer(service.obj).data,
                "version": ObjectVersionSerializer(version, context=self.get_serializer_context()).data,
                "workflow": service.payload(),
            }
        )

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        return object_workflow_required()

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
        self.get_object()
        return object_workflow_required()

    @action(detail=True, methods=["put", "patch"])
    def update_widgets(self, request, pk=None):
        self.get_object()
        return object_workflow_required()

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
        descendants = instance.get_descendants().select_related("object_type", "created_by")
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
        tree_objects = instance.get_tree_objects().select_related("object_type", "created_by")
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
        position = request.data.get("position", "last-child")  # first-child, last-child, left, right

        # Validate new parent
        new_parent = None
        if new_parent_id:
            try:
                new_parent = self.get_queryset().get(id=new_parent_id)
            except ObjectInstance.DoesNotExist:
                return Response({"error": "New parent not found"}, status=status.HTTP_404_NOT_FOUND)

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

            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        except Exception as e:
            return Response({"error": f"Move failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    # ============================================================================
    # RELATIONSHIP MANAGEMENT ACTIONS
    # ============================================================================

    @action(detail=True, methods=["get"])
    def relationships(self, request, pk=None):
        """
        Get all relationships for this object.

        Returns relationships grouped by type with related object details.
        """
        instance = self.get_object()

        # Get relationships with full object details
        from .serializers import RelatedObjectSerializer

        relationships_data = instance.get_related_objects(as_queryset=False)
        serializer = RelatedObjectSerializer(relationships_data, many=True)

        return Response({"relationships": serializer.data, "count": len(relationships_data)})

    @action(detail=True, methods=["post"])
    def add_relationship(self, request, pk=None):
        """
        Add a single relationship.

        Request body:
        {
            "relationship_type": "authors",
            "object_id": 123
        }
        """
        instance = self.get_object()
        relationship_type = request.data.get("relationship_type")
        object_id = request.data.get("object_id")

        if not relationship_type or not object_id:
            return Response(
                {"error": "Both relationship_type and object_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            added = instance.add_relationship(relationship_type, object_id)
            if added:
                return Response(
                    {
                        "message": "Relationship added successfully",
                        "relationship": {
                            "type": relationship_type,
                            "object_id": object_id,
                        },
                    }
                )
            else:
                return Response(
                    {"message": "Relationship already exists"},
                    status=status.HTTP_200_OK,
                )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def remove_relationship(self, request, pk=None):
        """
        Remove a specific relationship.

        Request body:
        {
            "relationship_type": "authors",
            "object_id": 123
        }
        """
        instance = self.get_object()
        relationship_type = request.data.get("relationship_type")
        object_id = request.data.get("object_id")

        if not relationship_type or not object_id:
            return Response(
                {"error": "Both relationship_type and object_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        removed = instance.remove_relationship(relationship_type, object_id)
        if removed:
            return Response({"message": "Relationship removed successfully"})
        else:
            return Response({"message": "Relationship not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["put"])
    def set_relationships(self, request, pk=None):
        """
        Replace all relationships of a specific type.

        Request body:
        {
            "relationship_type": "authors",
            "object_ids": [123, 456, 789]
        }
        """
        instance = self.get_object()
        relationship_type = request.data.get("relationship_type")
        object_ids = request.data.get("object_ids", [])

        if not relationship_type:
            return Response(
                {"error": "relationship_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(object_ids, list):
            return Response(
                {"error": "object_ids must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance.set_relationships(relationship_type, object_ids)
            return Response(
                {
                    "message": f"Relationships of type '{relationship_type}' updated successfully",
                    "count": len(object_ids),
                }
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reorder_relationships(self, request, pk=None):
        """
        Reorder relationships of a specific type.

        Request body:
        {
            "relationship_type": "authors",
            "object_ids": [456, 123, 789]  # In desired order
        }
        """
        instance = self.get_object()
        relationship_type = request.data.get("relationship_type")
        object_ids = request.data.get("object_ids", [])

        if not relationship_type:
            return Response(
                {"error": "relationship_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(object_ids, list):
            return Response(
                {"error": "object_ids must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance.reorder_relationships(relationship_type, object_ids)
            return Response({"message": f"Relationships of type '{relationship_type}' reordered successfully"})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def clear_relationships(self, request, pk=None):
        """
        Clear all relationships or relationships of a specific type.

        Request body (optional):
        {
            "relationship_type": "authors"  # If omitted, clears all relationships
        }
        """
        instance = self.get_object()
        relationship_type = request.data.get("relationship_type")

        instance.clear_relationships(relationship_type)

        if relationship_type:
            return Response({"message": f"Relationships of type '{relationship_type}' cleared successfully"})
        else:
            return Response({"message": "All relationships cleared successfully"})

    @action(detail=True, methods=["get"])
    def related_objects(self, request, pk=None):
        """
        Get related objects with full details.

        Query parameters:
        - relationship_type: Filter by relationship type (optional)
        """
        instance = self.get_object()
        relationship_type = request.query_params.get("relationship_type")

        # Get related objects
        related_objs = instance.get_related_objects(relationship_type=relationship_type, as_queryset=False)

        from .serializers import RelatedObjectSerializer

        serializer = RelatedObjectSerializer(related_objs, many=True)

        return Response({"related_objects": serializer.data, "count": len(related_objs)})

    @action(detail=True, methods=["get"])
    def related_from_objects(self, request, pk=None):
        """
        Get objects that have relationships TO this object (reverse relationships).

        Query parameters:
        - relationship_type: Filter by relationship type (optional)
        """
        instance = self.get_object()
        relationship_type = request.query_params.get("relationship_type")

        # Get reverse related objects
        related_objs = instance.get_related_from_objects(relationship_type=relationship_type, as_queryset=False)

        from .serializers import RelatedObjectSerializer

        serializer = RelatedObjectSerializer(related_objs, many=True)

        return Response({"related_from_objects": serializer.data, "count": len(related_objs)})

    @action(detail=True, methods=["post"])
    def rebuild_related_from(self, request, pk=None):
        """
        Rebuild the related_from field by scanning all other objects.
        Useful for repairing broken reverse relationships.
        """
        instance = self.get_object()
        count = instance.rebuild_related_from()

        return Response(
            {
                "message": "Related-from relationships rebuilt successfully",
                "count": count,
            }
        )

    @action(detail=False, methods=["post"])
    def rebuild_all_related_from(self, request):
        """
        Rebuild related_from fields for ALL ObjectInstance objects.
        Admin/maintenance endpoint for bulk repair.
        """
        stats = ObjectInstance.rebuild_all_related_from(tenant=request.tenant)

        return Response(
            {
                "message": "All related-from relationships rebuilt successfully",
                "statistics": stats,
            }
        )

    @action(detail=False, methods=["get"])
    def search_for_references(self, request):
        """
        Search for objects to reference in object_reference fields.

        Query params:
        - q: search term (searches title and slug)
        - object_types: comma-separated type names to filter
        - page: page number (default: 1)
        - page_size: results per page (default: 20, max: 100)

        Returns minimal object info for selection UI.
        """
        from django.core.paginator import Paginator
        from django.db.models import Q

        search_term = request.query_params.get("q", "").strip()
        object_types = request.query_params.get("object_types", "").strip()
        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 20)), 100)

        # Start with all objects
        queryset = self.get_queryset().select_related("object_type")

        # Filter by object types if specified
        if object_types:
            type_names = [t.strip() for t in object_types.split(",") if t.strip()]
            if type_names:
                queryset = queryset.filter(object_type__name__in=type_names)

        # Search by term
        if search_term:
            queryset = queryset.filter(Q(title__icontains=search_term) | Q(slug__icontains=search_term))

        # Order by relevance (title match first) and recency
        queryset = queryset.order_by("-created_at")

        # Paginate
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        # Serialize minimal data
        results = [
            {
                "id": obj.id,
                "title": obj.title,
                "slug": obj.slug,
                "object_type": {
                    "id": obj.object_type.id,
                    "name": obj.object_type.name,
                    "label": obj.object_type.label,
                },
                "created_at": obj.created_at,
            }
            for obj in page_obj
        ]

        return Response(
            {
                "results": results,
                "count": paginator.count,
                "page": page,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
            }
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
                return Response({"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND)

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
                return Response({"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND)

        # Filter by status
        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "all":
            instances = filter_publication_status(instances, status_filter)

        # Filter by hierarchy level
        level = request.query_params.get("level")
        if level:
            try:
                instances = instances.filter(level=int(level))
            except ValueError:
                pass

        # Filter by published status (using version-based logic)
        published_only = request.query_params.get("published_only", "").lower() == "true"
        if published_only:
            now = timezone.now()
            # Use version-based publishing logic
            from django.db.models import Exists, OuterRef

            from .models import ObjectVersion

            published_versions = ObjectVersion.objects.filter(
                object_instance=OuterRef("pk"), effective_date__lte=now
            ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

            instances = instances.filter(Exists(published_versions), current_version__isnull=False)

        # Order results by relevance
        if query:
            # Use database functions for better relevance scoring
            from django.db.models import Case, IntegerField, When

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
        tenant = getattr(request, "tenant", None)
        published_instances = (
            ObjectInstance.published.published_only(now)
            .filter(tenant=tenant)
            .select_related("object_type", "current_version", "created_by")
        )

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
            object_type_ids = [int(id.strip()) for id in object_types_param.split(",") if id.strip()]
        except ValueError:
            return Response(
                {"error": "Invalid object_types format. Expected comma-separated integers."},
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
            tenant=request.tenant,
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
            return Response({"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND)

        instances = self.get_queryset().filter(object_type=obj_type)

        # Apply additional filters from query params
        status_filter = request.query_params.get("status")
        if status_filter:
            instances = filter_publication_status(instances, status_filter)

        parent_id = request.query_params.get("parent")
        if parent_id:
            try:
                instances = instances.filter(parent_id=int(parent_id))
            except (ValueError, TypeError):
                return Response({"error": "Invalid parent ID"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-operations")
    def bulk_operations(self, request):
        """Perform bulk operations on multiple objects"""
        operation = request.data.get("operation")
        object_ids = request.data.get("object_ids", [])

        if not operation:
            return Response({"error": "Operation is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not object_ids:
            return Response({"error": "Object IDs are required"}, status=status.HTTP_400_BAD_REQUEST)

        if operation in {"publish", "unpublish", "archive"}:
            return object_workflow_required()

        # Get objects that exist and user has permission for
        objects = self.get_queryset().filter(id__in=object_ids)

        if not objects.exists():
            return Response({"error": "No valid objects found"}, status=status.HTTP_404_NOT_FOUND)

        results = []
        errors = []

        try:
            for obj in objects:
                try:
                    if operation == "publish":
                        obj.status = "published"
                        obj.save()
                        obj.create_version(request.user, change_description="Bulk published via API")
                        results.append({"id": obj.id, "status": "published"})

                    elif operation == "unpublish":
                        obj.status = "draft"
                        obj.save()
                        obj.create_version(request.user, change_description="Bulk unpublished via API")
                        results.append({"id": obj.id, "status": "unpublished"})

                    elif operation == "delete":
                        obj_id = obj.id
                        obj.delete()
                        results.append({"id": obj_id, "status": "deleted"})

                    elif operation == "archive":
                        obj.status = "archived"
                        obj.save()
                        obj.create_version(request.user, change_description="Bulk archived via API")
                        results.append({"id": obj.id, "status": "archived"})

                    else:
                        errors.append({"id": obj.id, "error": f"Unknown operation: {operation}"})

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

    queryset = ObjectVersion.objects.select_related("object_instance", "object_instance__object_type", "created_by")
    serializer_class = ObjectVersionSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["version_number", "created_at"]
    ordering = ["-version_number"]
    filterset_fields = ["object_instance", "object_instance__object_type"]

    def get_queryset(self):
        """Restrict versions to objects in the selected tenant."""
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            return super().get_queryset().none()
        return super().get_queryset().filter(object_instance__tenant=tenant)

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectVersionListSerializer
        return ObjectVersionSerializer

    def partial_update(self, request, pk=None):
        self.get_object()
        return object_workflow_required()

    def _workflow_action(self, request, operation):
        from .services.version_workflow import ObjectVersionWorkflow

        version = self.get_object()
        input_serializer = ObjectWorkflowInput(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        values = input_serializer.validated_data
        if str(values["expected_version_id"]) != str(version.id):
            raise serializers.ValidationError("The reviewed version must match the requested version.")
        service = ObjectVersionWorkflow(version.object_instance, request.user)
        arguments = {"version_id": values["expected_version_id"], "revision": values["expected_revision"]}
        if operation == "schedule":
            if "effective_date" not in values:
                raise serializers.ValidationError({"effective_date": "Choose a publication time."})
            arguments["effective_date"] = values["effective_date"]
            if "expiry_date" in values:
                arguments["expiry_date"] = values["expiry_date"]
        if operation == "restore":
            if "source_version_id" not in values:
                raise serializers.ValidationError({"source_version_id": "Choose a historical version."})
            arguments["source_id"] = values["source_version_id"]
        result = getattr(service, operation)(**arguments)
        return Response({"version": self.get_serializer(result).data, "workflow": service.payload()})

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        return self._workflow_action(request, "publish")

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        return self._workflow_action(request, "schedule")

    @action(detail=True, methods=["post"])
    def cancel_schedule(self, request, pk=None):
        return self._workflow_action(request, "cancel_schedule")

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        return self._workflow_action(request, "unpublish")

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return self._workflow_action(request, "restore")


def _can_manage_object_type_icon(user, tenant, object_type):
    if user.is_superuser:
        return True
    if tenant is None:
        return False
    if ObjectInstance.objects.filter(object_type=object_type).exclude(tenant=tenant).exists():
        return False
    namespace_tenant_id = object_type.namespace.tenant_id if object_type.namespace_id else None
    if namespace_tenant_id == tenant.id:
        return True
    return (
        namespace_tenant_id is None and ObjectInstance.objects.filter(object_type=object_type, tenant=tenant).exists()
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, HasTenantAccess])
def upload_image(request):
    """
    Upload an image file and optionally save it directly to an object type.

    If object_type_id is provided, the image will be saved directly to that object type.
    Otherwise, returns the URL for manual handling.
    """
    if "image" not in request.FILES:
        return Response({"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST)

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

    # If object_type_id is provided, validate it exists and is owned by this
    # workspace. Legacy global types may only be changed by a superuser, or by
    # their sole tenant user; otherwise an icon change would affect another
    # workspace without its authorization.
    object_type = None
    if object_type_id:
        try:
            object_type = ObjectTypeDefinition.objects.get(id=object_type_id)
        except ObjectTypeDefinition.DoesNotExist:
            return Response({"error": "Object type not found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_manage_object_type_icon(request.user, getattr(request, "tenant", None), object_type):
            return Response(
                {"error": "You do not have permission to update this object type"},
                status=status.HTTP_403_FORBIDDEN,
            )

    transfer_lock = None
    if object_type:
        from object_storage.services.transfer_checkpoints import object_type_transfer_lock

        transfer_lock = object_type_transfer_lock(object_type.id)
        transfer_lock.__enter__()
    try:
        if object_type:
            # Refetch after waiting for the shared resource lock. Its namespace
            # or tenant usage may have changed while this request was queued.
            object_type = ObjectTypeDefinition.objects.select_related("namespace").get(pk=object_type.pk)
            if not _can_manage_object_type_icon(request.user, getattr(request, "tenant", None), object_type):
                return Response(
                    {"error": "You do not have permission to update this object type"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Sanitize and validate file extension
        file_extension = os.path.splitext(image_file.name)[1].lower()

        # Whitelist allowed extensions
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
        if file_extension not in allowed_extensions:
            return Response(
                {"error": f"Invalid file extension. Allowed: {', '.join(allowed_extensions)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Sanitize extension to prevent path traversal
        safe_extension = re.sub(r"[^a-zA-Z0-9.]", "", file_extension)
        unique_filename = f"object_type_icons/{uuid.uuid4()}{safe_extension}"

        # Attached icons must use the model field's system storage; checkpoints
        # and renderers read that same backend. Unattached uploads retain the
        # historical default-storage behavior.
        icon_storage = object_type.icon_image.storage if object_type else default_storage
        file_path = icon_storage.save(unique_filename, ContentFile(image_file.read()))

        # Get the full URL
        file_url = request.build_absolute_uri(icon_storage.url(file_path))

        # If object_type_id was provided, save the image to the object type.
        # The short global barrier makes the final authorization check atomic
        # with ObjectInstance creation in another workspace.
        if object_type:
            from object_storage.services.transfer_checkpoints import reference_write_barrier, type_icon_path_locks

            old_path = object_type.icon_image.name if object_type.icon_image else ""
            with type_icon_path_locks([old_path, file_path]):
                with reference_write_barrier():
                    object_type = ObjectTypeDefinition.objects.select_related("namespace").get(pk=object_type.pk)
                    if not _can_manage_object_type_icon(request.user, getattr(request, "tenant", None), object_type):
                        icon_storage.delete(file_path)
                        return Response(
                            {"error": "You do not have permission to update this object type"},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    old_path = object_type.icon_image.name if object_type.icon_image else ""
                    object_type.icon_image.name = file_path
                    object_type.save(update_fields=["icon_image"])
                if old_path and not ObjectTypeDefinition.objects.filter(icon_image=old_path).exists():
                    try:
                        icon_storage.delete(old_path)
                    except Exception:
                        logger.exception("Could not delete superseded object-type icon %s", old_path)

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
    finally:
        if transfer_lock:
            transfer_lock.__exit__(None, None, None)
