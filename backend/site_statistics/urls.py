from django.urls import include, path
from rest_framework.routers import DefaultRouter

from site_statistics.views.analytics import ExperimentViewSet, PageStatsViewSet
from site_statistics.views.ingestion import EventIngestionView

router = DefaultRouter()
router.register(r"page-stats", PageStatsViewSet)
router.register(r"experiments", ExperimentViewSet)

urlpatterns = [
    path("ingest/", EventIngestionView.as_view(), name="event-ingest"),
    path("", include(router.urls)),
]
