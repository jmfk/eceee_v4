from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DataConnectionViewSet, DataStreamViewSet, DataTransformerViewSet

router = DefaultRouter()
router.register(r"connections", DataConnectionViewSet, basename="data-connection")
router.register(r"streams", DataStreamViewSet, basename="data-stream")
router.register(r"transformers", DataTransformerViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
