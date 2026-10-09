"""
Link resolution API views.

Provides endpoints for resolving link objects to URLs and getting link display info.
"""

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..services.link_resolver import (
    get_link_display_info,
    resolve_link,
)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def resolve_links(request):
    """
    Batch resolve link objects to URLs.

    POST /api/links/resolve/

    Request body:
    {
        "links": [
            {"type": "internal", "pageId": 123},
            {"type": "external", "url": "https://example.com"},
            ...
        ]
    }

    Returns:
    {
        "results": [
            {"original": {...}, "resolvedUrl": "/about/", "success": true},
            {"original": {...}, "resolvedUrl": "https://example.com", "success": true},
            ...
        ]
    }
    """
    links = request.data.get("links", [])

    if not isinstance(links, list):
        return Response(
            {"error": "links must be an array"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    results = []
    for link in links:
        try:
            resolved_url = resolve_link(link, request)
            results.append(
                {
                    "original": link,
                    "resolvedUrl": resolved_url,
                    "success": True,
                }
            )
        except Exception as e:
            results.append(
                {
                    "original": link,
                    "resolvedUrl": "#",
                    "success": False,
                    "error": str(e),
                }
            )

    return Response({"results": results}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def link_display_info(request):
    """
    Get display information for link objects.

    POST /api/links/display-info/

    Request body:
    {
        "links": [
            {"type": "internal", "pageId": 123},
            {"type": "external", "url": "https://example.com"},
            ...
        ]
    }

    Returns:
    {
        "results": [
            {
                "type": "internal",
                "label": "About Us",
                "resolvedUrl": "/about/",
                "pageTitle": "About Us",
                "pagePath": "/about/"
            },
            ...
        ]
    }
    """
    links = request.data.get("links", [])

    if not isinstance(links, list):
        return Response(
            {"error": "links must be an array"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    results = []
    for link in links:
        try:
            info = get_link_display_info(link)
            results.append(info)
        except Exception as e:
            results.append(
                {
                    "type": "error",
                    "label": "Error",
                    "resolvedUrl": "#",
                    "error": str(e),
                }
            )

    return Response({"results": results}, status=status.HTTP_200_OK)


def _page_lookup_data(page, roots_by_id, current_site_id=None):
    root_id = page.cached_root_id or (page.id if page.parent_id is None else None)
    root = roots_by_id.get(root_id)
    site_page = root if root and root.hostnames else None
    response_data = {
        "id": page.id,
        "title": page.title,
        "path": page.get_absolute_url(),
        "slug": page.slug,
        "is_published": page.is_currently_published,
        "parent_id": page.parent_id,
        "site_id": site_page.id if site_page else None,
    }
    if site_page and current_site_id and str(site_page.id) != str(current_site_id):
        response_data["site"] = {
            "id": site_page.id,
            "title": site_page.title,
            "slug": site_page.slug,
        }
    return response_data


def _lookup_pages(page_ids, tenant):
    from ..models import WebPage

    pages = list(WebPage.objects.filter(id__in=page_ids, tenant=tenant, is_deleted=False).order_by("id"))
    root_ids = {page.cached_root_id or page.id for page in pages if page.cached_root_id or page.parent_id is None}
    roots_by_id = WebPage.objects.filter(
        id__in=root_ids,
        tenant=tenant,
        is_deleted=False,
    ).in_bulk()
    return pages, roots_by_id


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def page_lookup(request):
    """
    Quick page info lookup by ID.

    GET /api/pages/lookup/?id=123
    POST /api/pages/lookup/ {"ids": [123, 456], "currentSiteId": 123}

    Returns:
    {
        "id": 123,
        "title": "About Us",
        "path": "/about/",
        "slug": "about",
        "isPublished": true,
        "siteTitle": "Main Site"  // if different from current site context
    }
    """
    tenant = getattr(request, "tenant", None)
    if tenant is None:
        return Response(
            {"error": "Tenant is required. Provide X-Tenant-ID header."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.method == "POST":
        page_ids = request.data.get("ids", [])
        current_site_id = request.data.get("current_site_id")
        if not isinstance(page_ids, list):
            return Response(
                {"error": "ids must be an array"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(page_ids) > 500:
            return Response(
                {"error": "ids must contain at most 500 page IDs"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        unique_ids = []
        seen_ids = set()
        for page_id in page_ids:
            if isinstance(page_id, bool) or not isinstance(page_id, (int, str)):
                return Response(
                    {"error": "ids must contain only positive integer page IDs"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                numeric_page_id = int(page_id)
            except (TypeError, ValueError):
                return Response(
                    {"error": "ids must contain only positive integer page IDs"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if numeric_page_id <= 0:
                return Response(
                    {"error": "ids must contain only positive integer page IDs"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if numeric_page_id not in seen_ids:
                seen_ids.add(numeric_page_id)
                unique_ids.append(numeric_page_id)
        pages, roots_by_id = _lookup_pages(unique_ids, tenant)
        pages_by_id = {page.id: page for page in pages}
        results = [
            _page_lookup_data(pages_by_id[page_id], roots_by_id, current_site_id)
            for page_id in unique_ids
            if page_id in pages_by_id
        ]
        return Response({"results": results}, status=status.HTTP_200_OK)

    page_id = request.query_params.get("id")
    current_site_id = request.query_params.get("currentSiteId")
    if not page_id:
        return Response(
            {"error": "id parameter is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        numeric_page_id = int(page_id)
        if numeric_page_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response(
            {"error": "id must be a positive integer"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    pages, roots_by_id = _lookup_pages([numeric_page_id], tenant)
    if not pages:
        return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(
        _page_lookup_data(pages[0], roots_by_id, current_site_id),
        status=status.HTTP_200_OK,
    )
