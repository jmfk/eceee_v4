from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DataConnectionViewSet, DataStreamViewSet, DataTransformerViewSet

router = DefaultRouter()
router.register(r'connections', DataConnectionViewSet)
router.register(r'streams', DataStreamViewSet)
router.register(r'transformers', DataTransformerViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

