from django.urls import path

from .views import CatalogView, DataQueryView, EventView, LogSearchView, SourcesView

urlpatterns = [
    path("sources/", SourcesView.as_view(), name="diagnostics-sources"),
    path("logs/search/", LogSearchView.as_view(), name="diagnostics-log-search"),
    path("logs/events/<str:event_id>/", EventView.as_view(), name="diagnostics-event"),
    path("data/catalog/", CatalogView.as_view(), name="diagnostics-catalog"),
    path("data/query/", DataQueryView.as_view(), name="diagnostics-query"),
]
