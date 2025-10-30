"""
API URL configuration for EASY v4.

This file contains all API endpoint routing for the application.
As you add new apps, include their API URLs here.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

app_name = "api"

# Create a router for ViewSets
router = DefaultRouter()

# Register content ViewSets
from content.views import (
    CategoryViewSet,
    TagViewSet,
    NamespaceViewSet,
)

router.register(r"categories", CategoryViewSet)
router.register(r"tags", TagViewSet)
router.register(r"namespaces", NamespaceViewSet)

urlpatterns = [
    # JWT Authentication endpoints
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # Include router URLs
    path("", include(router.urls)),
    # Include app-specific API URLs as you create them:
    # path('users/', include('apps.users.urls')),
    # path('core/', include('apps.core.urls')),
    path("webpages/", include("webpages.api_urls")),
    path("content/", include("content.urls")),
    path("content-import/", include("content_import.urls")),
    path("media/", include("file_manager.urls")),
    path("objects/", include("object_storage.urls")),
    path("utils/", include("utils.urls")),
    path("ai-tracking/", include("ai_tracking.urls")),
]
