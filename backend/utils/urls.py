"""
URL Configuration for General Utilities
"""

from django.urls import path, include
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
    # Website Rendering (temporarily disabled)
    # path(
    #     "render-website/",
    #     views.render_website_to_png,
    #     name="render_website_to_png",
    # ),
    # path(
    #     "render-website-info/",
    #     views.render_website_info,
    #     name="render_website_info",
    # ),
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
    # Include router URLs
    path("", include(router.urls)),
]
