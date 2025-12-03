"""
Link resolution API views.

Provides endpoints for resolving link objects to URLs and getting link display info.
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..services.link_resolver import (
    resolve_link,
    get_link_display_info,
    is_link_object,
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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def page_lookup(request):
    """
    Quick page info lookup by ID.

    GET /api/pages/lookup/?id=123

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
    from ..models import WebPage

    page_id = request.query_params.get("id")
    current_site_id = request.query_params.get("currentSiteId")

    if not page_id:
        return Response(
            {"error": "id parameter is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        page = WebPage.objects.get(id=page_id, is_deleted=False)

        # Build path by traversing parents
        # A page is a "site" if it has hostnames (ArrayField - check with bool)
        slugs = []
        current = page
        site_page = None

        while current:
            # Check if this page is a site (has hostnames)
            if current.hostnames:
                site_page = current
                break
            if current.slug:
                slugs.append(current.slug)

            # Fetch parent if exists
            if current.parent_id:
                current = WebPage.objects.get(id=current.parent_id, is_deleted=False)
            else:
                current = None

        # Reverse slugs to build path (we collected from leaf to root)
        slugs.reverse()
        calculated_path = "/" + "/".join(slugs) + "/" if slugs else "/"

        # Determine if we need to show site info
        site_info = None
        if site_page:
            # If currentSiteId provided and different from this page's site, include site info
            if current_site_id and str(site_page.id) != str(current_site_id):
                site_info = {
                    "id": site_page.id,
                    "title": site_page.title,
                    "slug": site_page.slug,
                }

        response_data = {
            "id": page.id,
            "title": page.title,
            "path": calculated_path,
            "slug": page.slug,
            "isPublished": page.is_currently_published,
            "parentId": page.parent_id,
            "siteId": site_page.id if site_page else None,
        }

        if site_info:
            response_data["site"] = site_info

        return Response(response_data, status=status.HTTP_200_OK)
    except WebPage.DoesNotExist:
        return Response(
            {"error": "Page not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
