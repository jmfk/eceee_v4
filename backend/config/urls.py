"""
URL configuration for ECEEE v4 AI-integrated development environment.

This configuration includes:
- Admin interface
- API endpoints with DRF
- Authentication endpoints
- Development tools (debug toolbar, silk profiling)
- Health check endpoints
- API documentation
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


def health_check(request):
    """Simple health check endpoint for container monitoring."""
    return JsonResponse(
        {"status": "healthy", "service": "eceee-v4-backend", "version": "1.0.0"}
    )


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
    # Monitoring and metrics
    path("metrics/", include("django_prometheus.urls")),
    # Web Page Publishing System - MUST be last for catch-all functionality
    path("", include("webpages.urls")),
]

# Development URLs
if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        # Debug toolbar
        path("__debug__/", include(debug_toolbar.urls)),
        # Silk profiling
        path("silk/", include("silk.urls", namespace="silk")),
    ]

    # Static and media files in development
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Custom admin configuration
admin.site.site_header = "ECEEE v4 Administration"
admin.site.site_title = "ECEEE v4 Admin"
admin.site.index_title = "Welcome to ECEEE v4 Administration"
