"""
Page Structure Query Helpers

Helper functions for querying page and version structure from the database.
These functions provide a clean API for accessing page hierarchy and metadata.
"""

from typing import List, Optional, Dict, Any
from django.db.models import Count, Q, Prefetch
from django.utils import timezone
from .structure_types import (
    PageMetadata,
    VersionMetadata,
    PageWithVersion,
    ChildPageInfo,
    PageTreeNode,
    WidgetSummary,
    PageStructureSummary,
    PageSearchOptions,
    VersionSearchOptions,
    BreadcrumbItem,
    PageStatus,
    VersionStatus,
    VersionFilter,
    StructureQueryError,
    StructureQueryErrorCode,
)


class PageStructureHelpers:
    """Helper functions for querying page structure"""

    def __init__(self, page_model, version_model):
        """
        Initialize with model classes

        Args:
            page_model: WebPage model class
            version_model: PageVersion model class
        """
        self.Page = page_model
        self.Version = version_model

    # Core Query Functions

    def get_page_by_id(
        self, page_id: int, version_filter: Optional[VersionFilter] = None
    ) -> Optional[PageMetadata]:
        """
        Get page metadata by ID.

        Args:
            page_id: Page ID
            version_filter: Optional filter to include version information

        Returns:
            PageMetadata or None if not found
        """
        try:
            page = self.Page.objects.select_related(
                "created_by", "last_modified_by", "parent"
            ).get(id=page_id, is_deleted=False)

            # Get version if requested
            version = None
            if version_filter:
                version = self._get_version_by_filter(page, version_filter)

            return self._page_to_metadata(page, version)
        except self.Page.DoesNotExist:
            return None

    def get_page_by_path(
        self,
        path: str,
        hostname: Optional[str] = None,
        version_filter: Optional[VersionFilter] = None,
    ) -> Optional[PageMetadata]:
        """
        Get page metadata by path.

        Args:
            path: Full path like "/about/team"
            hostname: Optional hostname for root page resolution
            version_filter: Optional filter to include version information

        Returns:
            PageMetadata or None if not found
        """
        # Clean path
        path = path.strip("/")
        if not path:
            # Root page requested
            if hostname:
                root_page = self.Page.get_root_page_for_hostname(hostname)
            else:
                root_page = self.Page.objects.filter(
                    parent__isnull=True, is_deleted=False
                ).first()

            if not root_page:
                return None

            # Get version if requested
            version = None
            if version_filter:
                version = self._get_version_by_filter(root_page, version_filter)

            return self._page_to_metadata(root_page, version)

        # Split path into segments
        segments = path.split("/")

        # Find root page
        if hostname:
            current_page = self.Page.get_root_page_for_hostname(hostname)
        else:
            current_page = self.Page.objects.filter(
                parent__isnull=True, slug=segments[0], is_deleted=False
            ).first()

        if not current_page:
            return None

        # Traverse path
        for i, segment in enumerate(segments):
            if i == 0 and not hostname:
                # Already found root by slug
                continue

            try:
                current_page = self.Page.objects.get(
                    parent=current_page, slug=segment, is_deleted=False
                )
            except self.Page.DoesNotExist:
                return None

        # Get version if requested
        version = None
        if version_filter:
            version = self._get_version_by_filter(current_page, version_filter)

        return self._page_to_metadata(current_page, version)

    def get_active_children(
        self, page_id: int, include_unpublished: bool = False
    ) -> List[ChildPageInfo]:
        """
        Get active child pages of a page.

        Args:
            page_id: Parent page ID
            include_unpublished: Whether to include pages without published versions

        Returns:
            List of ChildPageInfo objects
        """
        query = (
            self.Page.objects.filter(parent_id=page_id, is_deleted=False)
            .select_related("created_by", "last_modified_by")
            .annotate(
                child_count=Count("children", filter=Q(children__is_deleted=False))
            )
            .order_by("sort_order", "id")
        )

        children = []
        for child in query:
            current_version = self._get_current_published_version(child)

            if not include_unpublished and not current_version:
                continue

            children.append(
                ChildPageInfo(
                    page=self._page_to_metadata(child),
                    current_version=(
                        self._version_to_metadata(current_version)
                        if current_version
                        else None
                    ),
                    child_count=child.child_count,
                    sort_order=child.sort_order,
                )
            )

        return children

    def get_children_recursive(
        self,
        page_id: int,
        max_depth: Optional[int] = None,
        include_unpublished: bool = False,
    ) -> PageTreeNode:
        """
        Get page tree recursively.

        Args:
            page_id: Root page ID
            max_depth: Maximum depth to traverse (None = unlimited)
            include_unpublished: Whether to include pages without published versions

        Returns:
            PageTreeNode with nested children
        """
        try:
            page = (
                self.Page.objects.select_related("created_by", "last_modified_by")
                .annotate(
                    child_count=Count("children", filter=Q(children__is_deleted=False))
                )
                .get(id=page_id, is_deleted=False)
            )
        except self.Page.DoesNotExist:
            raise StructureQueryError(
                StructureQueryErrorCode.PAGE_NOT_FOUND, f"Page {page_id} not found"
            )

        return self._build_tree_node(page, 0, max_depth, include_unpublished)

    def get_ancestors(self, page_id: int) -> List[PageMetadata]:
        """
        Get all ancestor pages (parent, grandparent, etc.).

        Args:
            page_id: Page ID

        Returns:
            List of PageMetadata from immediate parent to root
        """
        try:
            page = self.Page.objects.select_related("parent").get(
                id=page_id, is_deleted=False
            )
        except self.Page.DoesNotExist:
            return []

        ancestors = []
        current = page.parent

        while current:
            if not current.is_deleted:
                ancestors.append(self._page_to_metadata(current))
            current = current.parent

        return ancestors

    def get_breadcrumbs(self, page_id: int) -> List[BreadcrumbItem]:
        """
        Get breadcrumb trail for a page.

        Args:
            page_id: Page ID

        Returns:
            List of BreadcrumbItem from root to current page
        """
        try:
            page = self.Page.objects.select_related("parent").get(
                id=page_id, is_deleted=False
            )
        except self.Page.DoesNotExist:
            return []

        # Collect pages from current to root
        pages = [page]
        current = page.parent
        while current:
            if not current.is_deleted:
                pages.insert(0, current)
            current = current.parent

        # Build breadcrumbs
        breadcrumbs = []
        for p in pages:
            breadcrumbs.append(
                BreadcrumbItem(
                    page_id=p.id,
                    title=p.title or p.slug,
                    slug=p.slug or "",
                    path=p.get_absolute_url(),
                )
            )

        return breadcrumbs

    def get_root_page(self, page_id: int) -> Optional[PageMetadata]:
        """
        Get the root page for a given page.

        Args:
            page_id: Page ID

        Returns:
            PageMetadata of root page or None
        """
        try:
            page = self.Page.objects.select_related("parent").get(
                id=page_id, is_deleted=False
            )
        except self.Page.DoesNotExist:
            return None

        # Traverse to root
        current = page
        while current.parent:
            current = current.parent

        return self._page_to_metadata(current)

    # Version Query Functions

    def get_version_by_id(self, version_id: int) -> Optional[VersionMetadata]:
        """Get version metadata by ID"""
        try:
            version = self.Version.objects.select_related(
                "created_by", "theme", "page"
            ).get(id=version_id, page__is_deleted=False)
            return self._version_to_metadata(version)
        except self.Version.DoesNotExist:
            return None

    def get_versions_for_page(
        self, page_id: int, status: Optional[VersionStatus] = None
    ) -> List[VersionMetadata]:
        """
        Get all versions for a page.

        Args:
            page_id: Page ID
            status: Optional status filter

        Returns:
            List of VersionMetadata ordered by version number (newest first)
        """
        query = (
            self.Version.objects.filter(page_id=page_id, page__is_deleted=False)
            .select_related("created_by", "theme", "page")
            .order_by("-version_number")
        )

        versions = []
        for version in query:
            version_status = self._get_version_status(version)

            if status and version_status != status:
                continue

            versions.append(self._version_to_metadata(version))

        return versions

    def get_current_version(self, page_id: int) -> Optional[VersionMetadata]:
        """Get the current published version for a page"""
        try:
            page = self.Page.objects.get(id=page_id, is_deleted=False)
            version = self._get_current_published_version(page)
            return self._version_to_metadata(version) if version else None
        except self.Page.DoesNotExist:
            return None

    def get_page_with_versions(self, page_id: int) -> Optional[PageWithVersion]:
        """
        Get page with version information.

        Args:
            page_id: Page ID

        Returns:
            PageWithVersion with current, published, and latest version info
        """
        try:
            page = (
                self.Page.objects.select_related("created_by", "last_modified_by")
                .annotate(version_count=Count("versions"))
                .get(id=page_id, is_deleted=False)
            )
        except self.Page.DoesNotExist:
            return None

        # Get different version types
        published_version = self._get_current_published_version(page)
        latest_version = page.get_latest_version()

        # Check for drafts
        has_draft = self.Version.objects.filter(
            page=page, effective_date__isnull=True
        ).exists()

        return PageWithVersion(
            page=self._page_to_metadata(page),
            current_version=(
                self._version_to_metadata(published_version)
                if published_version
                else None
            ),
            published_version=(
                self._version_to_metadata(published_version)
                if published_version
                else None
            ),
            latest_version=(
                self._version_to_metadata(latest_version) if latest_version else None
            ),
            version_count=page.version_count,
            has_draft=has_draft,
        )

    # Structure Summary Functions

    def get_page_structure_summary(
        self, page_id: int
    ) -> Optional[PageStructureSummary]:
        """
        Get comprehensive structure summary for a page.

        Args:
            page_id: Page ID

        Returns:
            PageStructureSummary with full structural information
        """
        try:
            page = (
                self.Page.objects.select_related(
                    "created_by", "last_modified_by", "parent"
                )
                .annotate(
                    child_count=Count("children", filter=Q(children__is_deleted=False)),
                )
                .get(id=page_id, is_deleted=False)
            )
        except self.Page.DoesNotExist:
            return None

        # Get ancestors
        ancestors = self.get_ancestors(page_id)
        ancestor_ids = [a.id for a in ancestors]

        # Get descendant count
        descendant_count = self._count_descendants(page_id)

        # Get current version
        current_version = self._get_current_published_version(page)

        # Get widget summary
        widget_summary = []
        if current_version:
            from .inheritance_helpers import InheritanceTreeHelpers
            from .inheritance_tree import InheritanceTreeBuilder

            builder = InheritanceTreeBuilder()
            tree = builder.build_tree(page)
            helpers = InheritanceTreeHelpers(tree)

            # Analyze each slot
            for slot_name in tree.slots.keys():
                all_widgets = helpers.get_all_widgets(slot_name)
                local_widgets = helpers.get_local_widgets(slot_name)
                inherited_widgets = helpers.get_inherited_widgets(slot_name)

                widget_types = list(set(w.type for w in all_widgets))

                widget_summary.append(
                    WidgetSummary(
                        slot_name=slot_name,
                        widget_count=len(all_widgets),
                        widget_types=widget_types,
                        has_inherited=len(inherited_widgets) > 0,
                        has_local=len(local_widgets) > 0,
                    )
                )

        # Get hostnames (only for root pages)
        hostnames = list(page.hostnames) if page.is_root_page() else []

        return PageStructureSummary(
            page=self._page_to_metadata(page),
            current_version=(
                self._version_to_metadata(current_version) if current_version else None
            ),
            ancestor_count=len(ancestors),
            ancestor_ids=ancestor_ids,
            child_count=page.child_count,
            descendant_count=descendant_count,
            widget_summary=widget_summary,
            hostnames=hostnames,
        )

    # Search Functions

    def search_pages(self, options: PageSearchOptions) -> List[PageMetadata]:
        """
        Search for pages with various filters.

        Args:
            options: Search options

        Returns:
            List of matching PageMetadata
        """
        query = self.Page.objects.filter(is_deleted=False).select_related(
            "created_by", "last_modified_by"
        )

        # Apply filters
        if options.parent_id is not None:
            query = query.filter(parent_id=options.parent_id)

        if options.root_only:
            query = query.filter(parent__isnull=True)

        if options.hostname:
            normalized = self.Page.normalize_hostname(options.hostname)
            query = query.filter(hostnames__contains=[normalized])

        # Filter by published status
        if not options.include_unpublished:
            # Only include pages with published versions
            now = timezone.now()
            published_version_ids = self.Version.objects.filter(
                Q(effective_date__lte=now) | Q(effective_date__isnull=False),
                Q(expiry_date__gt=now) | Q(expiry_date__isnull=True),
            ).values_list("page_id", flat=True)

            query = query.filter(id__in=published_version_ids)

        results = []
        for page in query.order_by("sort_order", "id"):
            results.append(self._page_to_metadata(page))

        return results

    # Helper Methods

    def _page_to_metadata(self, page, version=None) -> PageMetadata:
        """Convert Page model to PageMetadata"""
        return PageMetadata(
            id=page.id,
            title=page.title or "",
            slug=page.slug or "",
            description=page.description or "",
            path=page.get_absolute_url(),
            parent_id=page.parent_id,
            is_root=page.is_root_page(),
            created_at=page.created_at.isoformat() if page.created_at else "",
            updated_at=page.updated_at.isoformat() if page.updated_at else "",
            created_by=page.created_by.username if page.created_by else "",
            last_modified_by=(
                page.last_modified_by.username if page.last_modified_by else ""
            ),
            version=self._version_to_metadata(version) if version else None,
        )

    def _version_to_metadata(self, version) -> VersionMetadata:
        """Convert PageVersion model to VersionMetadata"""
        return VersionMetadata(
            id=version.id,
            version_number=version.version_number,
            version_title=version.version_title or "",
            meta_title=version.meta_title or "",
            meta_description=version.meta_description or "",
            code_layout=version.code_layout if version.code_layout else None,
            theme_id=version.theme_id,
            theme_name=version.theme.name if version.theme else None,
            effective_date=(
                version.effective_date.isoformat() if version.effective_date else None
            ),
            expiry_date=(
                version.expiry_date.isoformat() if version.expiry_date else None
            ),
            created_at=version.created_at.isoformat() if version.created_at else "",
            created_by=version.created_by.username if version.created_by else "",
            status=self._get_version_status(version),
        )

    def _get_current_published_version(self, page):
        """Get the currently published version for a page"""
        now = timezone.now()
        return (
            self.Version.objects.filter(
                page=page,
                effective_date__lte=now,
            )
            .filter(Q(expiry_date__gt=now) | Q(expiry_date__isnull=True))
            .order_by("-effective_date")
            .first()
        )

    def _get_version_status(self, version) -> VersionStatus:
        """Determine the status of a version"""
        if not version.effective_date:
            return VersionStatus.DRAFT

        now = timezone.now()

        if version.effective_date > now:
            return VersionStatus.SCHEDULED

        if version.expiry_date and version.expiry_date <= now:
            return VersionStatus.EXPIRED

        # Check if this is the current published version
        current = self._get_current_published_version(version.page)
        if current and current.id == version.id:
            return VersionStatus.CURRENT

        return VersionStatus.HISTORICAL

    def _get_version_by_filter(self, page, version_filter: VersionFilter):
        """Get version based on filter"""
        if version_filter == VersionFilter.CURRENT_PUBLISHED:
            # Get currently published version
            return self._get_current_published_version(page)

        elif version_filter == VersionFilter.LATEST:
            # Get most recent version regardless of status
            return page.get_latest_version()

        elif version_filter == VersionFilter.LATEST_DRAFT:
            # Get most recent draft (no effective date)
            return (
                self.Version.objects.filter(page=page, effective_date__isnull=True)
                .order_by("-version_number")
                .first()
            )

        elif version_filter == VersionFilter.LATEST_PUBLISHED:
            # Get most recent published version (can be current or expired)
            return (
                self.Version.objects.filter(page=page, effective_date__isnull=False)
                .order_by("-effective_date")
                .first()
            )

        return None

    def _build_tree_node(
        self, page, depth: int, max_depth: Optional[int], include_unpublished: bool
    ) -> PageTreeNode:
        """Recursively build tree node"""
        current_version = self._get_current_published_version(page)

        children = []
        if max_depth is None or depth < max_depth:
            child_pages = (
                self.Page.objects.filter(parent=page, is_deleted=False)
                .select_related("created_by", "last_modified_by")
                .annotate(
                    child_count=Count("children", filter=Q(children__is_deleted=False))
                )
                .order_by("sort_order", "id")
            )

            for child in child_pages:
                child_version = self._get_current_published_version(child)
                if not include_unpublished and not child_version:
                    continue

                children.append(
                    self._build_tree_node(
                        child, depth + 1, max_depth, include_unpublished
                    )
                )

        return PageTreeNode(
            page=self._page_to_metadata(page),
            current_version=(
                self._version_to_metadata(current_version) if current_version else None
            ),
            children=children,
            child_count=len(children),
            depth=depth,
        )

    def _count_descendants(self, page_id: int) -> int:
        """Count all descendants recursively"""
        count = 0
        children = self.Page.objects.filter(parent_id=page_id, is_deleted=False)
        count += children.count()

        for child in children:
            count += self._count_descendants(child.id)

        return count


# Convenience function to create helper instance
def get_structure_helpers():
    """Create a PageStructureHelpers instance with default models"""
    from .models import WebPage, PageVersion

    return PageStructureHelpers(WebPage, PageVersion)
