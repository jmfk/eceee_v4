"""
Django REST Framework views for the Web Page Publishing System

Provides API endpoints for managing pages, layouts, themes, widgets, and versions
with proper authentication, permissions, and filtering.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.utils import timezone

from .models import WebPage, PageVersion, PageLayout, PageTheme, WidgetType, PageWidget
from .serializers import (
    WebPageDetailSerializer,
    WebPageListSerializer,
    WebPageTreeSerializer,
    PageVersionSerializer,
    PageLayoutSerializer,
    PageThemeSerializer,
    WidgetTypeSerializer,
    PageWidgetSerializer,
    PageHierarchySerializer,
)
from .filters import WebPageFilter, PageVersionFilter


class PageLayoutViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing page layouts.
    Provides CRUD operations for layout templates.
    """

    queryset = PageLayout.objects.all()
    serializer_class = PageLayoutSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "created_by"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active layouts"""
        active_layouts = self.queryset.filter(is_active=True)
        serializer = self.get_serializer(active_layouts, many=True)
        return Response(serializer.data)


class PageThemeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing page themes.
    Provides CRUD operations for theme configurations.
    """

    queryset = PageTheme.objects.all()
    serializer_class = PageThemeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "created_by"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active themes"""
        active_themes = self.queryset.filter(is_active=True)
        serializer = self.get_serializer(active_themes, many=True)
        return Response(serializer.data)


class WidgetTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing widget types.
    Provides CRUD operations for widget type definitions.
    """

    queryset = WidgetType.objects.all()
    serializer_class = WidgetTypeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "created_by"]
    search_fields = ["name", "description", "template_name"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active widget types"""
        active_types = self.queryset.filter(is_active=True)
        serializer = self.get_serializer(active_types, many=True)
        return Response(serializer.data)


class WebPageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing web pages.
    Provides comprehensive CRUD operations with hierarchy support.
    """

    queryset = (
        WebPage.objects.select_related(
            "parent", "layout", "theme", "created_by", "last_modified_by"
        )
        .prefetch_related("children", "widgets__widget_type")
        .all()
    )

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = WebPageFilter
    search_fields = ["title", "slug", "description", "meta_title", "meta_description"]
    ordering_fields = [
        "title",
        "slug",
        "sort_order",
        "created_at",
        "updated_at",
        "effective_date",
    ]
    ordering = ["sort_order", "title"]

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action == "list":
            return WebPageListSerializer
        elif self.action in ["tree", "hierarchy"]:
            return WebPageTreeSerializer
        return WebPageDetailSerializer

    def get_queryset(self):
        """Filter queryset based on action and permissions"""
        queryset = super().get_queryset()

        if self.action in ["list", "retrieve"]:
            # For public endpoints, only show published pages to non-staff users
            if not self.request.user.is_staff:
                now = timezone.now()
                queryset = queryset.filter(
                    publication_status="published", effective_date__lte=now
                ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)
        # Create version after successful update
        if self.request.data:
            serializer.instance.create_version(self.request.user, "API update")

    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Get page hierarchy as a tree structure"""
        root_pages = self.get_queryset().filter(parent__isnull=True)
        serializer = PageHierarchySerializer(
            root_pages, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def published(self, request):
        """Get only published pages"""
        now = timezone.now()
        published_pages = (
            self.get_queryset()
            .filter(publication_status="published", effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        )

        page = self.paginate_queryset(published_pages)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(published_pages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a page immediately"""
        page = self.get_object()
        page.publication_status = "published"
        page.effective_date = timezone.now()
        page.last_modified_by = request.user
        page.save()

        # Create version
        page.create_version(request.user, "Published via API")

        serializer = self.get_serializer(page)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a page"""
        page = self.get_object()
        page.publication_status = "unpublished"
        page.last_modified_by = request.user
        page.save()

        # Create version
        page.create_version(request.user, "Unpublished via API")

        serializer = self.get_serializer(page)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def children(self, request, pk=None):
        """Get children of a specific page"""
        page = self.get_object()
        children = page.children.all()
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Move a page to a different parent"""
        page = self.get_object()
        new_parent_id = request.data.get("parent_id")
        new_sort_order = request.data.get("sort_order", 0)

        if new_parent_id:
            try:
                new_parent = WebPage.objects.get(id=new_parent_id)
                # Validate no circular reference
                current = new_parent
                while current:
                    if current == page:
                        return Response(
                            {"error": "Cannot move page to its own descendant"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    current = current.parent
                page.parent = new_parent
            except WebPage.DoesNotExist:
                return Response(
                    {"error": "Parent page not found"}, status=status.HTTP_404_NOT_FOUND
                )
        else:
            page.parent = None

        page.sort_order = new_sort_order
        page.last_modified_by = request.user
        page.save()

        # Create version
        page.create_version(request.user, f"Moved to parent {new_parent_id}")

        serializer = self.get_serializer(page)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """Preview a page with optional layout and theme overrides"""
        page = self.get_object()

        # Get override parameters
        layout_id = request.query_params.get("layout_id")
        theme_id = request.query_params.get("theme_id")

        preview_data = {
            "page": WebPageDetailSerializer(page, context={"request": request}).data,
            "effective_layout": None,
            "effective_theme": None,
            "widgets_by_slot": {},
        }

        # Determine effective layout
        if layout_id:
            try:
                preview_layout = PageLayout.objects.get(id=layout_id)
                preview_data["effective_layout"] = PageLayoutSerializer(
                    preview_layout
                ).data
            except PageLayout.DoesNotExist:
                preview_data["effective_layout"] = (
                    PageLayoutSerializer(page.get_effective_layout()).data
                    if page.get_effective_layout()
                    else None
                )
        else:
            preview_data["effective_layout"] = (
                PageLayoutSerializer(page.get_effective_layout()).data
                if page.get_effective_layout()
                else None
            )

        # Determine effective theme
        if theme_id:
            try:
                preview_theme = PageTheme.objects.get(id=theme_id)
                preview_data["effective_theme"] = PageThemeSerializer(
                    preview_theme
                ).data
            except PageTheme.DoesNotExist:
                preview_data["effective_theme"] = (
                    PageThemeSerializer(page.get_effective_theme()).data
                    if page.get_effective_theme()
                    else None
                )
        else:
            preview_data["effective_theme"] = (
                PageThemeSerializer(page.get_effective_theme()).data
                if page.get_effective_theme()
                else None
            )

        # Get widgets organized by slot (same logic as PageDetailView)
        inherited_widgets = {}
        current = page

        while current:
            for widget in current.widgets.all().order_by("sort_order"):
                slot_name = widget.slot_name

                if current == page or widget.inherit_from_parent:
                    if slot_name not in inherited_widgets or (
                        current == page and widget.override_parent
                    ):
                        if slot_name not in inherited_widgets:
                            inherited_widgets[slot_name] = []

                        widget_data = {
                            "widget": PageWidgetSerializer(widget).data,
                            "inherited_from": current.id if current != page else None,
                            "is_override": widget.override_parent,
                        }

                        if widget.override_parent:
                            inherited_widgets[slot_name] = [widget_data]
                        else:
                            inherited_widgets[slot_name].append(widget_data)

            current = current.parent

        preview_data["widgets_by_slot"] = inherited_widgets

        return Response(preview_data)

    @action(detail=True, methods=["get"])
    def inheritance_info(self, request, pk=None):
        """Get detailed inheritance information for a page"""
        page = self.get_object()

        inheritance_data = {
            "page_id": page.id,
            "inheritance_chain": [
                {"id": p.id, "title": p.title, "slug": p.slug, "level": i}
                for i, p in enumerate(page.get_inheritance_chain())
            ],
            "layout_info": page.get_layout_inheritance_info(),
            "theme_info": page.get_theme_inheritance_info(),
            "widgets_info": page.get_widgets_inheritance_info(),
            "conflicts": page.get_inheritance_conflicts(),
        }

        # Serialize complex objects
        if inheritance_data["layout_info"]["effective_layout"]:
            inheritance_data["layout_info"]["effective_layout"] = PageLayoutSerializer(
                inheritance_data["layout_info"]["effective_layout"]
            ).data

        if inheritance_data["theme_info"]["effective_theme"]:
            inheritance_data["theme_info"]["effective_theme"] = PageThemeSerializer(
                inheritance_data["theme_info"]["effective_theme"]
            ).data

        return Response(inheritance_data)

    @action(detail=True, methods=["post"])
    def apply_override(self, request, pk=None):
        """Apply an inheritance override"""
        page = self.get_object()

        override_type = request.data.get("override_type")
        override_value = request.data.get("override_value")

        if not override_type:
            return Response(
                {"error": "override_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Convert override_value to model instance if needed
            if override_type == "layout" and override_value:
                override_value = PageLayout.objects.get(id=override_value)
            elif override_type == "theme" and override_value:
                override_value = PageTheme.objects.get(id=override_value)

            success = page.apply_inheritance_override(override_type, override_value)

            if success:
                # Create a version after successful override
                page.create_version(request.user, f"Applied {override_type} override")

                return Response(
                    {
                        "success": True,
                        "message": f"{override_type.title()} override applied successfully",
                    }
                )
            else:
                return Response(
                    {"error": "Failed to apply override"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except (PageLayout.DoesNotExist, PageTheme.DoesNotExist):
            return Response(
                {"error": "Invalid override value"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PageVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for page versions (read-only).
    Versions are created automatically and can be restored.
    """

    queryset = PageVersion.objects.select_related("page", "created_by").all()
    serializer_class = PageVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = PageVersionFilter
    ordering_fields = ["version_number", "created_at"]
    ordering = ["-version_number"]

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore this version as the current version"""
        version = self.get_object()
        version.restore(request.user)

        serializer = self.get_serializer(version)
        return Response(
            {
                "message": f"Restored to version {version.version_number}",
                "version": serializer.data,
            }
        )

    @action(detail=False, methods=["get"])
    def compare(self, request):
        """Compare two versions"""
        version1_id = request.query_params.get("version1")
        version2_id = request.query_params.get("version2")

        if not version1_id or not version2_id:
            return Response(
                {"error": "Both version1 and version2 parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            version1 = PageVersion.objects.get(id=version1_id)
            version2 = PageVersion.objects.get(id=version2_id)
        except PageVersion.DoesNotExist:
            return Response(
                {"error": "One or both versions not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "version1": PageVersionSerializer(version1).data,
                "version2": PageVersionSerializer(version2).data,
                "changes": {
                    # TODO: Implement detailed diff logic
                    "summary": "Comparison feature coming soon"
                },
            }
        )


class PageWidgetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing page widgets.
    Provides CRUD operations for widgets on pages.
    """

    queryset = PageWidget.objects.select_related(
        "page", "widget_type", "created_by"
    ).all()
    serializer_class = PageWidgetSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = [
        "page",
        "widget_type",
        "slot_name",
        "inherit_from_parent",
        "override_parent",
    ]
    ordering_fields = ["slot_name", "sort_order", "created_at"]
    ordering = ["slot_name", "sort_order"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        # Create version for the page
        page = serializer.instance.page
        page.create_version(
            self.request.user, f"Added widget: {serializer.instance.widget_type.name}"
        )

    def perform_update(self, serializer):
        serializer.save()
        # Create version for the page
        page = serializer.instance.page
        page.create_version(
            self.request.user, f"Updated widget: {serializer.instance.widget_type.name}"
        )

    def perform_destroy(self, instance):
        page = instance.page
        widget_name = instance.widget_type.name
        instance.delete()
        # Create version for the page
        page.create_version(self.request.user, f"Removed widget: {widget_name}")

    @action(detail=False, methods=["get"])
    def by_page(self, request):
        """Get widgets for a specific page including inherited widgets"""
        page_id = request.query_params.get("page_id")
        if not page_id:
            return Response(
                {"error": "page_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            return Response(
                {"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get widgets for this page and inherited widgets
        widgets = []
        current_page = page

        while current_page:
            page_widgets = current_page.widgets.all()
            for widget in page_widgets:
                if widget.inherit_from_parent or current_page == page:
                    widgets.append(
                        {
                            "widget": PageWidgetSerializer(widget).data,
                            "inherited_from": (
                                current_page.id if current_page != page else None
                            ),
                        }
                    )
            current_page = current_page.parent

        return Response({"widgets": widgets})

    @action(detail=True, methods=["post"])
    def reorder(self, request, pk=None):
        """Reorder widgets within a slot"""
        widget = self.get_object()
        new_order = request.data.get("sort_order")

        if new_order is None:
            return Response(
                {"error": "sort_order is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        widget.sort_order = new_order
        widget.save()

        # Create version for the page
        widget.page.create_version(request.user, "Reordered widgets")

        serializer = self.get_serializer(widget)
        return Response(serializer.data)
