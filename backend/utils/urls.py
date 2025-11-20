"""
URL Configuration for General Utilities
"""

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from . import views

app_name = "utils"

# Create router for ViewSets
router = DefaultRouter()
router.register(r"value-lists", views.ValueListViewSet, basename="value-lists")
router.register(r"ai-tasks", views.AIAgentTaskViewSet, basename="ai-tasks")
router.register(
    r"ai-task-templates", views.AIAgentTaskTemplateViewSet, basename="ai-task-templates"
)
router.register(r"clipboard", views.ClipboardEntryViewSet, basename="clipboard")

# Custom clipboard URL patterns for path parameters
clipboard_patterns = [
    re_path(
        r"^clipboard/by-type/(?P<clipboard_type>[^/.]+)/$",
        views.ClipboardEntryViewSet.as_view({"get": "get_by_type", "delete": "clear_by_type"}),
        name="clipboard-by-type",
    ),
]

urlpatterns = [
    # Field Types
    path("field-types/", views.get_field_types, name="get_field_types"),
    path(
        "field-types/register/", views.register_field_type, name="register_field_type"
    ),
    # Value Lists
    path(
        "value-lists-for-field/",
        views.get_value_lists_for_field,
        name="get_value_lists_for_field",
    ),
    # AI Agent Task utilities
    path(
        "validate-task-config/",
        views.validate_task_config,
        name="validate_task_config",
    ),
    path(
        "task-statistics/",
        views.task_statistics,
        name="task_statistics",
    ),
    path(
        "tasks/<uuid:task_id>/stream/",
        views.task_sse_stream,
        name="task_sse_stream",
    ),
    # User Management
    path("current-user/", views.CurrentUserView.as_view(), name="current_user"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    path("users/", views.UserListView.as_view(), name="user_list"),
    path("users/<int:user_id>/", views.UserDetailView.as_view(), name="user_detail"),
    path(
        "users/<int:user_id>/reset-password/",
        views.GeneratePasswordResetView.as_view(),
        name="generate_password_reset",
    ),
    # Custom clipboard patterns (must come before router URLs)
    path("", include(clipboard_patterns)),
    # Include router URLs
    path("", include(router.urls)),
]
