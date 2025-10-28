"""
AI Tracking URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AIModelPriceViewSet,
    AIUsageLogViewSet,
    AnalyticsViewSet,
    AIBudgetAlertViewSet,
)

app_name = "ai_tracking"

router = DefaultRouter()
router.register(r"prices", AIModelPriceViewSet, basename="price")
router.register(r"usage", AIUsageLogViewSet, basename="usage")
router.register(r"analytics", AnalyticsViewSet, basename="analytics")
router.register(r"budgets", AIBudgetAlertViewSet, basename="budget")

urlpatterns = [
    path("", include(router.urls)),
]
