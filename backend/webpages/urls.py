"""
URL routing for the Web Page Publishing System API

Provides RESTful endpoints for managing pages, layouts, themes, widgets, and versions.
"""

from django.urls import path
from .public_views import (
    PageDetailView,
    PageListView,
    page_sitemap_view,
    page_hierarchy_api,
    page_search_view,
    render_widget,
    NewsDetailView,
    NewsListView,
    EventDetailView,
    EventListView,
    LibraryItemDetailView,
    LibraryItemListView,
    MemberDetailView,
    MemberListView,
)

app_name = "webpages"

urlpatterns = [
    # Public page views (slug-based routing)
    path("", PageListView.as_view(), name="page-list"),  # Root pages list
    path("sitemap.xml", page_sitemap_view, name="sitemap"),
    path("hierarchy.json", page_hierarchy_api, name="hierarchy-api"),
    path("search/", page_search_view, name="page-search"),
    path("widget/<int:widget_id>/", render_widget, name="render-widget"),
    # Object publishing URLs - canonical URLs for content objects
    path("news/", NewsListView.as_view(), name="news-list"),
    path("news/<slug:slug>/", NewsDetailView.as_view(), name="news-detail"),
    path("events/", EventListView.as_view(), name="event-list"),
    path("events/<slug:slug>/", EventDetailView.as_view(), name="event-detail"),
    path("library/", LibraryItemListView.as_view(), name="library-list"),
    path(
        "library/<slug:slug>/", LibraryItemDetailView.as_view(), name="library-detail"
    ),
    path("members/", MemberListView.as_view(), name="member-list"),
    path("members/<slug:slug>/", MemberDetailView.as_view(), name="member-detail"),
    # Hierarchical page routing - this must be last to catch all paths
    path("<path:slug_path>/", PageDetailView.as_view(), name="page-detail"),
    # Additional custom endpoints can be added here
    # path('api/pages/export/', export_pages_view, name='export-pages'),
    # path('api/pages/import/', import_pages_view, name='import-pages'),
]

"""
API Endpoint Documentation:

Pages:
- GET /api/pages/ - List all pages
- POST /api/pages/ - Create new page
- GET /api/pages/{id}/ - Get specific page
- PUT /api/pages/{id}/ - Update page
- PATCH /api/pages/{id}/ - Partial update page
- DELETE /api/pages/{id}/ - Delete page
- GET /api/pages/tree/ - Get page hierarchy tree
- GET /api/pages/published/ - Get only published pages
- POST /api/pages/{id}/publish/ - Publish a page
- POST /api/pages/{id}/unpublish/ - Unpublish a page
- GET /api/pages/{id}/children/ - Get page children
- POST /api/pages/{id}/move/ - Move page to different parent

Versions:
- GET /api/versions/ - List all versions
- GET /api/versions/{id}/ - Get specific version
- POST /api/versions/{id}/restore/ - Restore version
- GET /api/versions/compare/?version1={id}&version2={id} - Compare versions

Layouts:
- GET /api/layouts/ - List all layouts
- POST /api/layouts/ - Create new layout
- GET /api/layouts/{id}/ - Get specific layout
- PUT /api/layouts/{id}/ - Update layout
- DELETE /api/layouts/{id}/ - Delete layout
- GET /api/layouts/active/ - Get only active layouts

Themes:
- GET /api/themes/ - List all themes
- POST /api/themes/ - Create new theme
- GET /api/themes/{id}/ - Get specific theme
- PUT /api/themes/{id}/ - Update theme
- DELETE /api/themes/{id}/ - Delete theme
- GET /api/themes/active/ - Get only active themes

Widget Types:
- GET /api/widget-types/ - List all widget types
- POST /api/widget-types/ - Create new widget type
- GET /api/widget-types/{id}/ - Get specific widget type
- PUT /api/widget-types/{id}/ - Update widget type
- DELETE /api/widget-types/{id}/ - Delete widget type
- GET /api/widget-types/active/ - Get only active widget types

Widgets:
- GET /api/widgets/ - List all widgets
- POST /api/widgets/ - Create new widget
- GET /api/widgets/{id}/ - Get specific widget
- PUT /api/widgets/{id}/ - Update widget
- DELETE /api/widgets/{id}/ - Delete widget
- GET /api/widgets/by_page/?page_id={id} - Get widgets for specific page
- POST /api/widgets/{id}/reorder/ - Reorder widget

Query Parameters for Filtering:
Pages:
- ?title=search - Filter by title (case insensitive)
- ?slug=search - Filter by slug (case insensitive)
- ?publication_status=published - Filter by publication status
- ?is_published=true - Filter by current publication status
- ?parent={id} - Filter by parent page
- ?parent_isnull=true - Filter root pages only
- ?has_children=true - Filter pages with children
- ?depth_level=0 - Filter by hierarchy depth (0=root)
- ?layout={id} - Filter by layout
- ?theme={id} - Filter by theme
- ?created_after=2024-01-01 - Filter by creation date
- ?search=keyword - Search in title, slug, description
- ?ordering=sort_order - Order results

Versions:
- ?page={id} - Filter by page
- ?is_current=true - Filter current versions only
- ?created_after=2024-01-01 - Filter by creation date
- ?version_number_gte=5 - Filter by minimum version number

Layouts/Themes/Widget Types:
- ?is_active=true - Filter active items only
- ?name=search - Filter by name (case insensitive)
- ?in_use=true - Filter items currently in use

Authentication:
- Most endpoints require authentication
- Read-only access available for public published content
- Staff users have full access to all content
"""
