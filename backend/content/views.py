"""
Content Object Views for Object Publishing System

Provides REST API views for content objects that can be published as pages.
"""

from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone

from .models import Category, Tag, Namespace
from .serializers import (
    CategorySerializer,
    TagSerializer,
    NamespaceSerializer,
    NamespaceListSerializer,
)


class NamespaceViewSet(viewsets.ModelViewSet):
    """ViewSet for Namespace model"""

    queryset = Namespace.objects.all()
    serializer_class = NamespaceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["name", "slug", "created_at", "is_default"]
    ordering = ["-is_default", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return NamespaceListSerializer
        return NamespaceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by tenant from middleware
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Filter by default status
        is_default = self.request.query_params.get("is_default")
        if is_default is not None:
            queryset = queryset.filter(is_default=is_default.lower() == "true")

        return queryset

    def perform_create(self, serializer):
        # Get tenant from request (set by middleware)
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Provide X-Tenant-ID header.")
        serializer.save(created_by=self.request.user, tenant=tenant)

    def perform_update(self, serializer):
        # If setting this namespace as default, unset others
        if serializer.validated_data.get("is_default", False):
            Namespace.objects.filter(is_default=True).exclude(
                pk=serializer.instance.pk
            ).update(is_default=False)
        serializer.save()

    @action(detail=True, methods=["post"])
    def set_as_default(self, request, pk=None):
        """Set this namespace as the default namespace"""
        namespace = self.get_object()

        # Unset all other namespaces as default
        Namespace.objects.filter(is_default=True).exclude(pk=namespace.pk).update(
            is_default=False
        )

        # Set this namespace as default
        namespace.is_default = True
        namespace.save()

        return Response(
            {
                "message": f"Namespace '{namespace.name}' set as default",
                "namespace": NamespaceSerializer(namespace).data,
            }
        )

    @action(detail=True, methods=["post"])
    def get_content_summary(self, request, pk=None):
        """Get detailed content summary for this namespace"""
        namespace = self.get_object()

        # Get counts for each content type
        category_count = namespace.categories.count()
        tag_count = namespace.tags.count()

        return Response(
            {
                "namespace": NamespaceSerializer(namespace).data,
                "content_summary": {
                    "categories": category_count,
                    "tags": tag_count,
                    "total": category_count + tag_count,
                },
            }
        )


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category model"""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by tenant from middleware
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        return queryset


class TagViewSet(viewsets.ModelViewSet):
    """Enhanced ViewSet for Tag model with namespace and usage features"""

    queryset = Tag.objects.select_related("namespace")
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["namespace"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at", "usage_count"]
    ordering = ["-usage_count", "name"]

    def get_queryset(self):
        """Filter tags with enhanced options"""
        queryset = Tag.objects.select_related("namespace")

        # Filter by tenant from middleware
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)

        # Filter by namespace (use default if not specified)
        namespace_id = self.request.query_params.get("namespace")
        if namespace_id:
            queryset = queryset.filter(namespace_id=namespace_id)
        else:
            # Use default namespace if none specified
            default_namespace = Namespace.get_default()
            queryset = queryset.filter(namespace=default_namespace)

        return queryset

    @action(detail=False, methods=["get"])
    def popular(self, request):
        """Get most popular tags"""
        namespace_id = request.query_params.get("namespace")
        limit = int(request.query_params.get("limit", 20))

        namespace = None
        if namespace_id:
            namespace = get_object_or_404(Namespace, id=namespace_id)

        tags = Tag.get_popular_tags(namespace=namespace, limit=limit)
        serializer = self.get_serializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search_tags(self, request):
        """Search tags with query"""
        query = request.query_params.get("q", "")
        namespace_id = request.query_params.get("namespace")
        limit = int(request.query_params.get("limit", 10))

        if not query:
            return Response(
                {"error": "Query parameter q is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        namespace = None
        if namespace_id:
            namespace = get_object_or_404(Namespace, id=namespace_id)

        tags = Tag.search_tags(query=query, namespace=namespace, limit=limit)
        serializer = self.get_serializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def increment_usage(self, request, pk=None):
        """Increment usage count for a tag"""
        tag = self.get_object()
        tag.increment_usage()

        return Response(
            {
                "id": tag.id,
                "usage_count": tag.usage_count,
            }
        )

    @action(detail=False, methods=["post"])
    def get_or_create(self, request):
        """Get existing tag or create new one"""
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        namespace_id = request.data.get("namespace")
        namespace = None
        if namespace_id:
            namespace = get_object_or_404(Namespace, id=namespace_id)

        # Extract additional fields
        extra_fields = {
            key: value
            for key, value in request.data.items()
            if key not in ["name", "namespace"]
        }

        tag, created = Tag.get_or_create_tag(
            name=name, namespace=namespace, **extra_fields
        )

        serializer = self.get_serializer(tag)
        return Response(
            {**serializer.data, "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
