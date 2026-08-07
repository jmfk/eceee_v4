from django.urls import path, include
from rest_framework.routers import DefaultRouter
from site_statistics.views.ingestion import EventIngestionView
from site_statistics.views.analytics import PageStatsViewSet, ExperimentViewSet

router = DefaultRouter()
router.register(r"page-stats", PageStatsViewSet)
router.register(r"experiments", ExperimentViewSet)

urlpatterns = [
    path("ingest/", EventIngestionView.as_view(), name="event-ingest"),
    path("", include(router.urls)),
]
