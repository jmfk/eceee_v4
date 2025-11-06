"""
URL configuration for EASY v4 AI-integrated development environment.

This configuration includes:
- Admin interface
- API endpoints with DRF
- Authentication endpoints
- Development tools (debug toolbar, silk profiling)
- Health check endpoints
- API documentation
- Multi-site hostname-aware routing
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from django.views.decorators.csrf import ensure_csrf_cookie

# Import hostname-aware views for multi-site functionality
from webpages.public_views import HostnamePageView
from webpages.views.lightbox import lightbox_item_view, lightbox_group_view


def health_check(request):
    """Simple health check endpoint for container monitoring."""
    return JsonResponse(
        {"status": "healthy", "service": "eceee-v4-backend", "version": "1.0.0"}
    )


# CSRF token endpoint for React frontend
@ensure_csrf_cookie
def csrf_token_view(request):
    """
    Endpoint to provide CSRF token for React frontend
    """
    return JsonResponse({"csrfToken": request.META.get("CSRF_COOKIE")})


urlpatterns = [
    # Admin interface
    path("admin/", admin.site.urls),
    # Health check
    path("health/", health_check, name="health_check"),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # API endpoints
    path("api/v1/", include("config.api_urls")),
    # HTMX demonstrations
    path("htmx/", include("htmx.urls")),
    # Authentication
    path("api/auth/", include("rest_framework.urls")),
    path("accounts/", include("allauth.urls")),
    # Web Page Publishing System (admin/API functions)
    path("webpages/", include("webpages.urls")),
    # Lightbox (HTMX endpoints)
    path("lb/item", lightbox_item_view, name="lightbox-item"),
    path("lb/group", lightbox_group_view, name="lightbox-group"),
    # Monitoring and metrics
    path("metrics/", include("django_prometheus.urls")),
    # CSRF token endpoint for frontend
    path("csrf-token/", csrf_token_view, name="csrf-token"),
    # Multi-site hostname-aware routing - MUST be last for catch-all functionality
    path("", HostnamePageView.as_view(), name="hostname-root"),
    path("<path:slug_path>/", HostnamePageView.as_view(), name="hostname-page-detail"),
]

# Development URLs
if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        # Debug toolbar
        path("__debug__/", include(debug_toolbar.urls)),
    ]

    # Static and media files in development
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Custom admin configuration
admin.site.site_header = "EASY v4 Administration"
admin.site.site_title = "EASY v4 Admin"
admin.site.index_title = "Welcome to EASY v4 Administration"

# Custom error handlers for site-specific error pages
handler404 = "webpages.public_views.custom_404_handler"
handler500 = "webpages.public_views.custom_500_handler"
handler403 = "webpages.public_views.custom_403_handler"
