from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ImporterCatalogView,
    ImporterPreflightView,
    MigrationJobViewSet,
    MigrationPlanViewSet,
    MigrationTaskViewSet,
    PluginActivationView,
    PluginCatalogView,
    PluginImportJobDetailView,
    PluginImportJobListView,
)

router = DefaultRouter()
router.register(r"plans", MigrationPlanViewSet, basename="migration-plan")
router.register(r"jobs", MigrationJobViewSet, basename="migration-job")
router.register(r"tasks", MigrationTaskViewSet, basename="migration-task")

urlpatterns = [
    path("plugins/", PluginCatalogView.as_view(), name="tenant-plugin-catalog"),
    path("plugins/<path:plugin_id>/activation/", PluginActivationView.as_view(), name="tenant-plugin-activation"),
    path("importers/", ImporterCatalogView.as_view(), name="tenant-importer-catalog"),
    path("importers/<path:importer_id>/preflight/", ImporterPreflightView.as_view(), name="tenant-importer-preflight"),
    path("plugin-jobs/", PluginImportJobListView.as_view(), name="plugin-import-job-list"),
    path("plugin-jobs/<uuid:job_id>/", PluginImportJobDetailView.as_view(), name="plugin-import-job-detail"),
    path("", include(router.urls)),
]
