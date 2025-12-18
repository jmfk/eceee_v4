from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"field-types", views.FormFieldTypeViewSet)
router.register(r"forms", views.FormViewSet)
router.register(r"submissions", views.FormSubmissionViewSet)

urlpatterns = [
    path("", include(router.urls)),
]

