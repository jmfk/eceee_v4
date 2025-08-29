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
    filterset_fields = ["is_active"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return ObjectTypeDefinitionListSerializer
        return ObjectTypeDefinitionSerializer

    def perform_create(self, serializer):
        """Set the created_by field when creating"""
        serializer.save(created_by=self.request.user)

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
            "created_by", "parent_object"
        )

        # Apply filters
        status_filter = request.query_params.get("status")
        if status_filter:
            instances = instances.filter(status=status_filter)

        serializer = ObjectInstanceListSerializer(instances, many=True)
        return Response(serializer.data)


class ObjectInstanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Object Instances"""

    queryset = ObjectInstance.objects.select_related(
        "object_type", "created_by", "parent_object"
    ).prefetch_related("versions")
    serializer_class = ObjectInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "slug", "data"]
    ordering_fields = ["title", "created_at", "updated_at", "publish_date"]
    ordering = ["-created_at"]
    filterset_fields = ["object_type", "status", "parent_object"]

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
        """Get child objects of this instance"""
        instance = self.get_object()
        children = instance.get_children().select_related("object_type", "created_by")
        serializer = ObjectInstanceListSerializer(children, many=True)
        return Response(serializer.data)

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
