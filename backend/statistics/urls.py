from django.urls import path, include
from rest_framework.routers import DefaultRouter
from statistics.views.ingestion import EventIngestionView
from statistics.views.analytics import PageStatsViewSet, ExperimentViewSet

router = DefaultRouter()
router.register(r"page-stats", PageStatsViewSet)
router.register(r"experiments", ExperimentViewSet)

urlpatterns = [
    path("ingest/", EventIngestionView.as_view(), name="event-ingest"),
    path("api/", include(router.urls)),
]

