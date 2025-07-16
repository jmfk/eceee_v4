"""
API URL configuration for ECEEE v4.

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

# Create a router for ViewSets
router = DefaultRouter()

# As you create new apps with ViewSets, register them here:
# router.register(r'users', UserViewSet)
# router.register(r'posts', PostViewSet)

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
    path("webpages/", include("webpages.urls")),
    path("content/", include("content.urls")),
]
