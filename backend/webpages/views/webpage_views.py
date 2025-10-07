"""
WebPage ViewSet for managing web pages.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.throttling import UserRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone

from ..models import WebPage, PageVersion
from ..serializers import (
    WebPageSimpleSerializer,
    WebPageTreeSerializer,
    PageHierarchySerializer,
)
from ..filters import WebPageFilter


class WebPageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing web pages with rate limiting for hostname operations."""

    queryset = (
        WebPage.objects.select_related("parent", "created_by", "last_modified_by")
        .prefetch_related("children")
        .all()
    )

    permission_classes = [permissions.IsAuthenticated]
    # Rate limiting for hostname management security
    throttle_classes = [UserRateThrottle]
    throttle_scope = "webpage_modifications"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = WebPageFilter
    search_fields = [
        "slug",
    ]
    ordering_fields = [
        "slug",
        "sort_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "sort_order",
        "id",
    ]

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action in ["tree", "hierarchy"]:
            return WebPageTreeSerializer
        # Use simplified serializer by default (no version data)
        return WebPageSimpleSerializer

    def get_queryset(self):
        """Filter queryset based on action and permissions"""
        queryset = super().get_queryset()

        if self.action in ["list", "retrieve"]:
            # For public endpoints, only show published pages to non-staff users
            if not self.request.user.is_staff:
                # Use database-level filtering to avoid N+1 queries
                # This uses the same logic as WebPageFilter.filter_is_published
                now = timezone.now()

                # Subquery to check if page has published versions
                published_version_exists = PageVersion.objects.filter(
                    page=OuterRef("pk"), effective_date__lte=now
                ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

                queryset = queryset.filter(Exists(published_version_exists))

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

        # Normalize sort orders for the parent group
        page = serializer.instance
        WebPage.normalize_sort_orders(page.parent_id)

    def retrieve(self, request, pk=None):
        """Get WebPage data only - no version data included"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="full")
    def full_data(self, request, pk=None):
        """Get full page data including version content (LEGACY ENDPOINT)"""
        # This maintains backward compatibility with the old combined API
        page = self.get_object()
        serializer = WebPageSimpleSerializer(
            page, context={"request": request, "include_version_info": True}
        )
        return Response(serializer.data)

    def perform_update(self, serializer):
        """Update WebPage fields only - no version creation"""
        # Save only WebPage fields, last_modified_by is updated automatically
        serializer.save(last_modified_by=self.request.user)

        # Note: Version creation must now be handled explicitly via PageVersionViewSet
        # This separation ensures clean boundaries between page and version management

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
        # Get pages that have published versions
        published_page_ids = (
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )

        published_pages = self.get_queryset().filter(id__in=published_page_ids)

        page = self.paginate_queryset(published_pages)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(published_pages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        page = self.get_object()
        now = timezone.now()

        # Handle anonymous user for development
        user = request.user if request.user.is_authenticated else None
        if user:
            page.last_modified_by = user
        page.save()

        # Create published version
        version = page.create_version(user, "Published via API")
        # Set effective_date to publish immediately
        version.effective_date = now
        version.save()

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page published successfully",
                "effective_date": version.effective_date,
                "expiry_date": version.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        page = self.get_object()
        now = timezone.now()

        # Handle anonymous user for development
        user = request.user if request.user.is_authenticated else None
        if user:
            page.last_modified_by = user
        page.save()

        # Create unpublished version (no effective_date means it's a draft)
        version = page.create_version(user, "Unpublished via API")

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page unpublished successfully",
                "effective_date": version.effective_date,
                "expiry_date": version.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="widget-inheritance")
    def widget_inheritance(self, request, pk=None):
        """
        Get widget inheritance information for this page.

        Returns inherited widgets from parent pages organized by slot,
        along with slot-level inheritance rules.
        """
        page = self.get_object()

        # Get inheritance info from the model method
        inheritance_info = page.get_widgets_inheritance_info()

        # Get effective layout to determine slot rules
        effective_layout = page.get_effective_layout()

        # Build response structure
        response_data = {
            "pageId": page.id,
            "parentId": page.parent_id if page.parent else None,
            "hasParent": page.parent is not None,
            "slots": {},
        }

        # Process each slot's inheritance info
        for slot_name, slot_info in inheritance_info.items():
            # Get slot configuration from layout
            slot_config = {}
            if effective_layout and effective_layout.slot_configuration:
                slots = effective_layout.slot_configuration.get("slots", [])
                slot_config = next((s for s in slots if s.get("name") == slot_name), {})

            # Determine inheritance rules (with defaults)
            # Header/footer typically allow inheritance, main content typically doesn't
            default_allows_inheritance = slot_name in ["header", "footer", "sidebar"]

            # Check which fields are explicitly set (priority: allow_merge > allows_replacement_only > requires_local)
            has_allow_merge = "allow_merge" in slot_config
            has_allows_replacement_only = "allows_replacement_only" in slot_config
            has_requires_local = (
                "requires_local" in slot_config
            )  # Backward compatibility
            has_allows_inheritance = "allows_inheritance" in slot_config

            # Get values with priority order
            if has_allow_merge:
                # New preferred field - use directly
                allow_merge = slot_config.get("allow_merge", True)
                allows_replacement_only = not allow_merge
            else:
                # Fall back to old naming for compatibility
                allows_replacement_only = slot_config.get(
                    "allows_replacement_only",
                    slot_config.get("requires_local", False),  # Fallback to oldest name
                )
                allow_merge = not allows_replacement_only

            allows_inheritance = slot_config.get(
                "allows_inheritance", default_allows_inheritance
            )

            # Apply mutual exclusivity: allow_merge takes highest precedence
            if has_allow_merge:
                # allow_merge is explicitly set - use it and derive others
                allows_inheritance = (
                    allows_inheritance if allow_merge else allows_inheritance
                )
                allows_replacement_only = not allow_merge
            elif has_allows_replacement_only or has_requires_local:
                # Old replacement-only field is set - use it and invert for merge
                allow_merge = not allows_replacement_only
            elif has_allows_inheritance:
                # Only allows_inheritance is set - derive merge from it
                allow_merge = allows_inheritance
                allows_replacement_only = not allows_inheritance
            # else: use defaults

            # Always return inherited widgets - let frontend decide display logic
            # Use the raw inherited widgets field (preserves them even when overridden)
            inherited_widgets = []
            raw_inherited = slot_info.get("inherited_widgets_raw", [])
            
            for widget_info in raw_inherited:
                inherited_from = widget_info.get("inherited_from")

                # Include all inherited widgets
                if inherited_from:
                    widget_data = widget_info["widget"].copy()

                    # Add inheritance metadata
                    widget_data["inheritedFrom"] = {
                        "id": inherited_from.id,
                        "title": inherited_from.title,
                        "slug": inherited_from.slug,
                    }
                    widget_data["isInherited"] = True
                    widget_data["canOverride"] = True

                    # Calculate inheritance depth
                    depth = 1
                    current = page.parent
                    while current and current != inherited_from:
                        depth += 1
                        current = current.parent
                    widget_data["inheritanceDepth"] = depth

                    inherited_widgets.append(widget_data)

            # Build slot response
            response_data["slots"][slot_name] = {
                "hasInheritedWidgets": len(inherited_widgets) > 0,
                "inheritedWidgets": inherited_widgets,
                "inheritanceAllowed": allows_inheritance,
                "allowMerge": allow_merge,  # New preferred field
                "allowsReplacementOnly": allows_replacement_only,  # Backward compatibility
                "requiresLocal": allows_replacement_only,  # Backward compatibility - deprecated
                "mergeMode": allows_inheritance and allow_merge,
                "inheritableTypes": slot_info.get(
                    "inheritable_types", []
                ),  # NEW: Type-based inheritance
            }

        return Response(response_data)
