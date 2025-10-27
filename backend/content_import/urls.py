"""URL configuration for Content Import app."""

from django.urls import path
from .views import CaptureScreenshotView, ExtractContentView, ProcessImportView


app_name = 'content_import'

urlpatterns = [
    path('capture/', CaptureScreenshotView.as_view(), name='capture'),
    path('extract/', ExtractContentView.as_view(), name='extract'),
    path('process/', ProcessImportView.as_view(), name='process'),
]

