from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MigrationPlanViewSet, MigrationJobViewSet, MigrationTaskViewSet

router = DefaultRouter()
router.register(r'plans', MigrationPlanViewSet, basename='migration-plan')
router.register(r'jobs', MigrationJobViewSet, basename='migration-job')
router.register(r'tasks', MigrationTaskViewSet, basename='migration-task')

urlpatterns = [
    path('', include(router.urls)),
]

