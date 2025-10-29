"""
WebPage ViewSet for managing web pages.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.throttling import UserRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from django.db.models import Q, Exists, OuterRef, F
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

        # Exclude deleted pages by default (unless specifically accessing deleted endpoint)
        # Check if is_deleted field exists (migration might not be run yet)
        if self.action not in ["list_deleted", "bulk_restore"]:
            try:
                queryset = queryset.filter(is_deleted=False)
            except Exception:
                # is_deleted field doesn't exist yet (migration not run)
                pass

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
        Get widget inheritance tree for this page.

        NEW: Returns complete inheritance tree structure instead of slot-based data.
        Provides backward compatibility by also including legacy slot format.
        """
        page = self.get_object()

        try:
            # NEW: Build inheritance tree
            from .inheritance_tree import InheritanceTreeBuilder
            from .inheritance_helpers import InheritanceTreeHelpers

            builder = InheritanceTreeBuilder()
            tree = builder.build_tree(page)
            helpers = InheritanceTreeHelpers(tree)

            # Convert tree to JSON-serializable format
            tree_json = self._serialize_tree_node(tree)

            # Get tree statistics
            stats = builder.get_tree_statistics(tree)

            # Build new response format (snake_case auto-converted to camelCase)
            response_data = {
                "version": "tree",  # API version identifier
                "tree": tree_json,
                "statistics": {
                    "node_count": stats.node_count,
                    "max_depth": stats.max_depth,
                    "total_widgets": stats.total_widgets,
                    "generation_time_ms": stats.generation_time_ms,
                },
                # Legacy compatibility - convert tree back to slot format
                "legacy": self._convert_tree_to_legacy_format(tree, helpers),
            }

            return Response(response_data)

        except Exception as e:
            # Fallback to old system
            return self._widget_inheritance_legacy(page)

    def _widget_inheritance_legacy(self, page):
        """Legacy widget inheritance method (backup)"""
        # Get inheritance info from the model method
        inheritance_info = page.get_widgets_inheritance_info()

        # Get effective layout to determine slot rules
        effective_layout = page.get_effective_layout()

        # Build response structure (snake_case will be auto-converted to camelCase)
        response_data = {
            "page_id": page.id,
            "parent_id": page.parent_id if page.parent else None,
            "has_parent": page.parent is not None,
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

                    # Add inheritance metadata (snake_case will be auto-converted to camelCase)
                    widget_data["inherited_from"] = {
                        "id": inherited_from.id,
                        "title": inherited_from.title,
                        "slug": inherited_from.slug,
                    }
                    widget_data["is_inherited"] = True
                    widget_data["can_override"] = True

                    # Calculate inheritance depth
                    depth = 1
                    current = page.parent
                    while current and current != inherited_from:
                        depth += 1
                        current = current.parent
                    widget_data["inheritance_depth"] = depth

                    inherited_widgets.append(widget_data)

            # Build slot response (snake_case will be auto-converted to camelCase by DRF renderer)
            response_data["slots"][slot_name] = {
                "has_inherited_widgets": len(inherited_widgets) > 0,
                "inherited_widgets": inherited_widgets,
                "inheritance_allowed": allows_inheritance,
                "allow_merge": allow_merge,  # New preferred field
                "allows_replacement_only": allows_replacement_only,  # Backward compatibility
                "requires_local": allows_replacement_only,  # Backward compatibility - deprecated
                "merge_mode": allows_inheritance and allow_merge,
                "inheritable_types": slot_info.get(
                    "inheritable_types", []
                ),  # Type-based inheritance
                "collapse_behavior": slot_config.get(
                    "collapse_behavior", "any"
                ),  # Collapse behavior: "never", "any", "all"
            }

        return Response(response_data)

    def _serialize_tree_node(self, node):
        """Convert InheritanceTreeNode to JSON-serializable dictionary (snake_case auto-converted)"""
        serialized_slots = {}

        for slot_name, widgets in node.slots.items():
            serialized_slots[slot_name] = [
                {
                    "id": widget.id,
                    "type": widget.type,
                    "config": widget.config,
                    "order": widget.order,
                    "depth": widget.depth,
                    "inheritance_behavior": widget.inheritance_behavior.value,
                    "is_published": widget.is_published,
                    "inheritance_level": widget.inheritance_level,
                    "publish_effective_date": widget.publish_effective_date,
                    "publish_expire_date": widget.publish_expire_date,
                    "is_local": widget.is_local,
                    "is_inherited": widget.is_inherited,
                    "can_be_overridden": widget.can_be_overridden,
                }
                for widget in widgets
            ]

        return {
            "page_id": node.page_id,
            "depth": node.depth,
            "page": {
                "id": node.page.id,
                "title": node.page.title,
                "slug": node.page.slug,
                "parent_id": node.page.parent_id,
                "description": node.page.description,
                "layout": node.page.layout,
                "theme": node.page.theme,
                "hostname": node.page.hostname,
            },
            "slots": serialized_slots,
            "parent": self._serialize_tree_node(node.parent) if node.parent else None,
        }

    def _convert_tree_to_legacy_format(self, tree, helpers):
        """Convert tree back to legacy slot-based format (snake_case auto-converted)"""
        legacy_data = {
            "page_id": tree.page_id,
            "parent_id": tree.parent.page_id if tree.parent else None,
            "has_parent": tree.parent is not None,
            "slots": {},
        }

        # Get all slots from tree
        all_slots = set()
        current = tree
        while current:
            all_slots.update(current.slots.keys())
            current = current.parent

        # Convert each slot to legacy format
        for slot_name in all_slots:
            inherited_widgets = helpers.get_inherited_widgets(slot_name)

            legacy_data["slots"][slot_name] = {
                "has_inherited_widgets": len(inherited_widgets) > 0,
                "inherited_widgets": [
                    {
                        "id": widget.id,
                        "type": widget.type,
                        "config": widget.config,
                        "inherited_from": {
                            "id": tree.parent.page_id if tree.parent else None,
                            "title": tree.parent.page.title if tree.parent else None,
                            "slug": tree.parent.page.slug if tree.parent else None,
                        },
                        "is_inherited": True,
                        "can_override": widget.can_be_overridden,
                        "inheritance_depth": widget.depth,
                        "inheritance_behavior": widget.inheritance_behavior.value,
                    }
                    for widget in inherited_widgets
                ],
                "inheritance_allowed": True,
                "merge_mode": True,
                "inheritable_types": [],
            }

        return legacy_data

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        """
        Bulk soft delete pages.

        Request body:
        {
            "page_ids": [1, 2, 3],
            "recursive": true  // optional, default false
        }
        """
        page_ids = request.data.get("page_ids", [])
        recursive = request.data.get("recursive", False)

        if not page_ids:
            return Response(
                {"error": "page_ids is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch pages
        pages = WebPage.objects.filter(id__in=page_ids, is_deleted=False)

        if not pages.exists():
            return Response(
                {"error": "No valid pages found for deletion"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Perform soft delete
        total_deleted = 0
        deleted_pages = []

        for page in pages:
            count = page.soft_delete(user=request.user, recursive=recursive)
            total_deleted += count
            deleted_pages.append(
                {
                    "id": page.id,
                    "title": page.title,
                    "slug": page.slug,
                    "deleted_count": count,
                }
            )

        return Response(
            {
                "message": f"Successfully deleted {total_deleted} page(s)",
                "total_deleted": total_deleted,
                "pages": deleted_pages,
                "recursive": recursive,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request):
        """
        Bulk restore soft-deleted pages.

        Request body:
        {
            "page_ids": [1, 2, 3],
            "recursive": true  // optional, default false
        }
        """
        page_ids = request.data.get("page_ids", [])
        recursive = request.data.get("recursive", False)

        if not page_ids:
            return Response(
                {"error": "page_ids is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch deleted pages
        pages = WebPage.objects.filter(id__in=page_ids, is_deleted=True)

        if not pages.exists():
            return Response(
                {"error": "No deleted pages found for restoration"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Perform restore
        total_restored = 0
        restored_pages = []

        for page in pages:
            count = page.restore(user=request.user, recursive=recursive)
            total_restored += count
            restored_pages.append(
                {
                    "id": page.id,
                    "title": page.title,
                    "slug": page.slug,
                    "restored_count": count,
                }
            )

        return Response(
            {
                "message": f"Successfully restored {total_restored} page(s)",
                "total_restored": total_restored,
                "pages": restored_pages,
                "recursive": recursive,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="bulk-publish")
    def bulk_publish(self, request):
        """
        Bulk publish multiple pages.

        Request body:
        {
            "page_ids": [1, 2, 3],
            "change_summary": "Bulk publish operation"  // optional
        }
        """
        page_ids = request.data.get("page_ids", [])
        change_summary = request.data.get("change_summary", "Bulk publish operation")

        if not page_ids:
            return Response(
                {"error": "page_ids is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Use publishing service
        from ..publishing import PublishingService

        publishing_service = PublishingService(request.user)
        published_count, errors = publishing_service.bulk_publish_pages(
            page_ids, change_summary
        )

        response_data = {
            "message": f"Successfully published {published_count} page(s)",
            "published_count": published_count,
        }

        if errors:
            response_data["errors"] = errors
            response_data["message"] += f" with {len(errors)} error(s)"

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-unpublish")
    def bulk_unpublish(self, request):
        """
        Bulk unpublish multiple pages.

        Request body:
        {
            "page_ids": [1, 2, 3],
            "change_summary": "Bulk unpublish operation"  // optional
        }
        """
        page_ids = request.data.get("page_ids", [])
        change_summary = request.data.get("change_summary", "Bulk unpublish operation")

        if not page_ids:
            return Response(
                {"error": "page_ids is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch pages
        pages = WebPage.objects.filter(id__in=page_ids, is_deleted=False)

        if not pages.exists():
            return Response(
                {"error": "No valid pages found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Unpublish each page
        unpublished_count = 0
        errors = []

        for page in pages:
            try:
                # Get latest version
                latest_version = page.versions.order_by("-version_number").first()

                if not latest_version:
                    # Create a new version if none exists
                    latest_version = page.create_version(request.user, change_summary)

                # Clear effective_date to unpublish
                latest_version.effective_date = None
                latest_version.save(update_fields=["effective_date"])

                unpublished_count += 1

            except Exception as e:
                error_msg = f"Failed to unpublish {page.title}: {str(e)}"
                errors.append(error_msg)

        response_data = {
            "message": f"Successfully unpublished {unpublished_count} page(s)",
            "unpublished_count": unpublished_count,
        }

        if errors:
            response_data["errors"] = errors
            response_data["message"] += f" with {len(errors)} error(s)"

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """
        Create a duplicate of this page.

        Creates a copy with:
        - Same parent
        - Title with "(Copy)" suffix
        - Slug with "-copy" suffix (with number if needed)
        - All page data, widgets, and settings copied
        - Placed after original page (sortOrder + 1)
        """
        page = self.get_object()

        # Generate new title and slug
        new_title = f"{page.title} (Copy)"
        base_slug = f"{page.slug}-copy"

        # Find unique slug
        new_slug = base_slug
        counter = 1
        while WebPage.objects.filter(
            parent=page.parent, slug=new_slug, is_deleted=False
        ).exists():
            new_slug = f"{base_slug}-{counter}"
            counter += 1

        try:
            # Get latest version to copy from
            latest_version = page.versions.order_by("-version_number").first()

            # Create new page
            new_page = WebPage.objects.create(
                parent=page.parent,
                slug=new_slug,
                sort_order=page.sort_order + 1,
                created_by=request.user,
                last_modified_by=request.user,
            )

            # Create version with copied data
            if latest_version:
                new_version = PageVersion.objects.create(
                    page=new_page,
                    version_number=1,
                    created_by=request.user,
                    change_summary="Duplicated from original page",
                    # Copy version data
                    title=new_title,
                    layout_name=latest_version.layout_name,
                    theme_id=latest_version.theme_id,
                    widgets=latest_version.widgets,
                    page_data=latest_version.page_data,
                    seo_title=latest_version.seo_title,
                    seo_description=latest_version.seo_description,
                    seo_keywords=latest_version.seo_keywords,
                    # Don't copy publishing dates - start as draft
                    effective_date=None,
                    expiry_date=None,
                )
            else:
                # No version exists, create basic version
                new_version = new_page.create_version(
                    request.user, "Duplicated from original page"
                )
                new_version.title = new_title
                new_version.save()

            # Shift sort orders of pages after this one
            WebPage.objects.filter(
                parent=page.parent, sort_order__gt=page.sort_order, is_deleted=False
            ).update(sort_order=F("sort_order") + 1)

            serializer = self.get_serializer(new_page)
            return Response(
                {
                    "message": f"Page duplicated successfully as '{new_title}'",
                    "page": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to duplicate page: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="bulk-move")
    def bulk_move(self, request):
        """
        Move multiple pages to a new parent.

        Request body:
        {
            "page_ids": [1, 2, 3],
            "parent_id": 5,  // null for root level
            "sort_order": 10  // optional, where to place first page
        }
        """
        page_ids = request.data.get("page_ids", [])
        parent_id = request.data.get("parent_id")
        sort_order = request.data.get("sort_order", 0)

        if not page_ids:
            return Response(
                {"error": "page_ids is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get parent page if specified
        parent_page = None
        if parent_id:
            try:
                parent_page = WebPage.objects.get(id=parent_id, is_deleted=False)
            except WebPage.DoesNotExist:
                return Response(
                    {"error": f"Parent page {parent_id} not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Fetch pages to move
        pages = WebPage.objects.filter(id__in=page_ids, is_deleted=False)

        if not pages.exists():
            return Response(
                {"error": "No valid pages found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check for circular references
        if parent_page:
            for page in pages:
                # Check if trying to move parent into its own child
                ancestor = parent_page
                while ancestor:
                    if ancestor.id == page.id:
                        return Response(
                            {
                                "error": f"Cannot move page '{page.title}' into its own descendant"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    ancestor = ancestor.parent

        # Move pages
        moved_count = 0
        errors = []
        current_sort_order = sort_order

        for page in pages:
            try:
                page.parent = parent_page
                page.sort_order = current_sort_order
                page.last_modified_by = request.user
                page.save()

                moved_count += 1
                current_sort_order += 10  # Space out pages

            except Exception as e:
                error_msg = f"Failed to move {page.title}: {str(e)}"
                errors.append(error_msg)

        response_data = {
            "message": f"Successfully moved {moved_count} page(s)",
            "moved_count": moved_count,
        }

        if errors:
            response_data["errors"] = errors
            response_data["message"] += f" with {len(errors)} error(s)"

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="deleted")
    def list_deleted(self, request):
        """Get list of soft-deleted pages"""
        deleted_pages = self.get_queryset().filter(is_deleted=True)

        page = self.paginate_queryset(deleted_pages)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(deleted_pages, many=True)
        return Response(serializer.data)
