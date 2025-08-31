"""
URL Configuration for General Utilities
"""

from django.urls import path
from . import views

app_name = "utils"

urlpatterns = [
    path("field-types/", views.get_field_types, name="get_field_types"),
    path(
        "field-types/register/", views.register_field_type, name="register_field_type"
    ),
]
