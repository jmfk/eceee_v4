"""
Page Structure API Views

REST API endpoints for querying page structure and metadata.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from dataclasses import asdict

from .structure_helpers import get_structure_helpers
from .structure_types import (
    PageSearchOptions,
    VersionSearchOptions,
    VersionStatus,
    VersionFilter,
    StructureQueryError,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_metadata_view(request, page_id):
    """
    Get page metadata by ID.

    GET /api/pages/{page_id}/metadata/?version_filter=current_published

    Query params:
        version_filter: Optional filter (current_published, latest, latest_draft, latest_published)
    """
    # Parse version_filter parameter
    version_filter = _parse_version_filter(request.query_params.get("version_filter"))

    helpers = get_structure_helpers()
    page_metadata = helpers.get_page_by_id(page_id, version_filter=version_filter)

    if not page_metadata:
        raise Http404("Page not found")

    return Response(asdict(page_metadata))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_by_path_view(request):
    """
    Get page metadata by path.

    GET /api/pages/by-path/?path=/about/team&hostname=example.com&version_filter=current_published

    Query params:
        path: Page path
        hostname: Optional hostname for root resolution
        version_filter: Optional filter (current_published, latest, latest_draft, latest_published)
    """
    path = request.query_params.get("path", "")
    hostname = request.query_params.get("hostname")
    version_filter = _parse_version_filter(request.query_params.get("version_filter"))

    helpers = get_structure_helpers()
    page_metadata = helpers.get_page_by_path(
        path, hostname, version_filter=version_filter
    )

    if not page_metadata:
        raise Http404("Page not found")

    return Response(asdict(page_metadata))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_children_view(request, page_id):
    """
    Get active child pages.

    GET /api/pages/{page_id}/children/?include_unpublished=false
    """
    include_unpublished = (
        request.query_params.get("include_unpublished", "false").lower() == "true"
    )

    helpers = get_structure_helpers()
    print("page_id", page_id)
    children = helpers.get_active_children(page_id, include_unpublished)

    return Response([asdict(child) for child in children])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_tree_view(request, page_id):
    """
    Get page tree recursively.

    GET /api/pages/{page_id}/tree/?max_depth=3&include_unpublished=false
    """
    max_depth_str = request.query_params.get("max_depth")
    max_depth = int(max_depth_str) if max_depth_str else None
    include_unpublished = (
        request.query_params.get("include_unpublished", "false").lower() == "true"
    )

    helpers = get_structure_helpers()

    try:
        tree = helpers.get_children_recursive(page_id, max_depth, include_unpublished)
        return Response(_tree_node_to_dict(tree))
    except StructureQueryError as e:
        return Response(
            {"error": e.message, "code": e.code},
            status=(
                status.HTTP_404_NOT_FOUND
                if e.code == "PAGE_NOT_FOUND"
                else status.HTTP_400_BAD_REQUEST
            ),
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_ancestors_view(request, page_id):
    """
    Get all ancestor pages.

    GET /api/pages/{page_id}/ancestors/
    """
    helpers = get_structure_helpers()
    ancestors = helpers.get_ancestors(page_id)

    return Response([asdict(ancestor) for ancestor in ancestors])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_breadcrumbs_view(request, page_id):
    """
    Get breadcrumb trail.

    GET /api/pages/{page_id}/breadcrumbs/
    """
    helpers = get_structure_helpers()
    breadcrumbs = helpers.get_breadcrumbs(page_id)

    return Response([asdict(item) for item in breadcrumbs])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_root_view(request, page_id):
    """
    Get the root page.

    GET /api/pages/{page_id}/root/
    """
    helpers = get_structure_helpers()
    root = helpers.get_root_page(page_id)

    if not root:
        raise Http404("Root page not found")

    return Response(asdict(root))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def version_metadata_view(request, version_id):
    """
    Get version metadata by ID.

    GET /api/page-versions/{version_id}/metadata/
    """
    helpers = get_structure_helpers()
    version_metadata = helpers.get_version_by_id(version_id)

    if not version_metadata:
        raise Http404("Version not found")

    return Response(asdict(version_metadata))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_versions_view(request, page_id):
    """
    Get all versions for a page.

    GET /api/pages/{page_id}/versions/?status=current
    """
    status_param = request.query_params.get("status")
    version_status = None

    if status_param:
        try:
            version_status = VersionStatus(status_param)
        except ValueError:
            return Response(
                {"error": f"Invalid status: {status_param}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    helpers = get_structure_helpers()
    versions = helpers.get_versions_for_page(page_id, version_status)

    return Response([asdict(version) for version in versions])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_current_version_view(request, page_id):
    """
    Get current published version.

    GET /api/pages/{page_id}/current-version/
    """
    helpers = get_structure_helpers()
    version = helpers.get_current_version(page_id)

    if not version:
        return Response(None, status=status.HTTP_204_NO_CONTENT)

    return Response(asdict(version))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_with_versions_view(request, page_id):
    """
    Get page with version information.

    GET /api/pages/{page_id}/with-versions/
    """
    helpers = get_structure_helpers()
    page_with_versions = helpers.get_page_with_versions(page_id)

    if not page_with_versions:
        raise Http404("Page not found")

    return Response(asdict(page_with_versions))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def page_structure_summary_view(request, page_id):
    """
    Get comprehensive structure summary.

    GET /api/pages/{page_id}/structure-summary/
    """
    helpers = get_structure_helpers()
    summary = helpers.get_page_structure_summary(page_id)

    if not summary:
        raise Http404("Page not found")

    return Response(asdict(summary))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pages_search_view(request):
    """
    Search for pages.

    GET /api/pages/search/?parent_id=1&root_only=true&include_unpublished=false
    """
    options = PageSearchOptions(
        include_drafts=request.query_params.get("include_drafts", "false").lower()
        == "true",
        include_unpublished=request.query_params.get(
            "include_unpublished", "false"
        ).lower()
        == "true",
        parent_id=(
            int(request.query_params.get("parent_id"))
            if request.query_params.get("parent_id")
            else None
        ),
        root_only=request.query_params.get("root_only", "false").lower() == "true",
        has_published_version=_parse_bool_param(
            request.query_params.get("has_published_version")
        ),
        layout_type=request.query_params.get("layout_type"),
        theme_id=(
            int(request.query_params.get("theme_id"))
            if request.query_params.get("theme_id")
            else None
        ),
        hostname=request.query_params.get("hostname"),
    )

    helpers = get_structure_helpers()
    pages = helpers.search_pages(options)

    return Response([asdict(page) for page in pages])


# Helper functions


def _tree_node_to_dict(node):
    """Recursively convert PageTreeNode to dictionary"""
    return {
        "page": asdict(node.page),
        "current_version": (
            asdict(node.current_version) if node.current_version else None
        ),
        "children": [_tree_node_to_dict(child) for child in node.children],
        "child_count": node.child_count,
        "depth": node.depth,
    }


def _parse_bool_param(value):
    """Parse boolean parameter that can be null"""
    if value is None or value == "":
        return None
    return value.lower() == "true"


def _parse_version_filter(value):
    """Parse version_filter parameter"""
    if not value:
        return None
    try:
        return VersionFilter(value)
    except ValueError:
        return None
