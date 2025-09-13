"""
General utility API views for the schema system and value lists
"""

import logging
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .schema_system import field_registry, register_custom_field_type
from .models import (
    ValueList,
    ValueListItem,
    AIAgentTask,
    AIAgentTaskTemplate,
    AIAgentTaskUpdate,
)
from .serializers import (
    ValueListSerializer,
    ValueListItemSerializer,
    ValueListCreateSerializer,
    ValueListUpdateSerializer,
    ValueListItemCreateSerializer,
    AIAgentTaskSerializer,
    AIAgentTaskCreateSerializer,
    AIAgentTaskTemplateSerializer,
    AIAgentTaskFromTemplateSerializer,
    TaskStatusUpdateSerializer,
    TaskConfigValidationSerializer,
)

from .website_renderer import WebsiteRenderer, WebsiteRenderingError

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_field_types(request):
    """Get all available field types"""
    field_types = field_registry.get_all_field_types()

    # Convert to API-friendly format
    result = []
    for key, field_info in field_types.items():
        result.append(
            {
                "key": key,
                "label": field_info["label"],
                "jsonSchemaType": field_info["json_schema_type"],
                "component": field_info["component"],  # Updated from uiComponent
                "configComponent": field_info.get("config_component"),
                "category": field_info.get("category", "input"),
                "description": field_info["description"],
                "validationRules": field_info["validation_rules"],
                "uiProps": field_info.get("ui_props", {}),
            }
        )

    return Response({"fieldTypes": result, "count": len(result)})


@api_view(["POST"])
# @permission_classes([IsAuthenticated])  # Temporarily removed for testing
def register_field_type(request):
    """Register a new custom field type"""
    try:
        data = request.data

        # Validate required fields
        required_fields = ["key", "label", "jsonSchemaType", "component"]
        for field in required_fields:
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Register the field type
        register_custom_field_type(
            key=data["key"],
            label=data["label"],
            json_schema_type=data["jsonSchemaType"],
            component=data["component"],  # Updated from ui_component
            category=data.get("category", "input"),
            config_component=data.get("configComponent"),
            description=data.get("description", ""),
            validation_rules=data.get("validationRules", {}),
            ui_props=data.get("uiProps", {}),
        )

        return Response(
            {
                "message": f"Field type '{data['key']}' registered successfully",
                "fieldType": {
                    "key": data["key"],
                    "label": data["label"],
                    "jsonSchemaType": data["jsonSchemaType"],
                    "component": data["component"],
                    "configComponent": data.get("configComponent"),
                    "category": data.get("category", "input"),
                    "description": data.get("description", ""),
                    "uiProps": data.get("uiProps", {}),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        return Response(
            {"error": f"Failed to register field type: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ValueListViewSet(viewsets.ModelViewSet):
    """ViewSet for managing value lists"""

    queryset = ValueList.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return ValueListCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return ValueListUpdateSerializer
        return ValueListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        """Get items for a specific value list"""
        value_list = self.get_object()
        items = value_list.items.filter(is_active=True).order_by("order", "label")
        serializer = ValueListItemSerializer(items, many=True)
        return Response(
            {
                "value_list": ValueListSerializer(value_list).data,
                "items": serializer.data,
                "count": items.count(),
            }
        )

    @action(detail=True, methods=["post"])
    def add_item(self, request, pk=None):
        """Add an item to a value list"""
        value_list = self.get_object()

        serializer = ValueListItemCreateSerializer(
            data=request.data, context={"value_list": value_list}
        )

        if serializer.is_valid():
            item = serializer.save(value_list=value_list)
            return Response(
                ValueListItemSerializer(item).data, status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["delete"])
    def remove_item(self, request, pk=None):
        """Remove an item from a value list"""
        value_list = self.get_object()
        item_id = request.data.get("item_id")

        if not item_id:
            return Response(
                {"error": "item_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            item = value_list.items.get(id=item_id)
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueListItem.DoesNotExist:
            return Response(
                {"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["post"])
    def reorder_items(self, request, pk=None):
        """Reorder items in a value list"""
        value_list = self.get_object()
        item_orders = request.data.get("item_orders", [])

        if not isinstance(item_orders, list):
            return Response(
                {"error": "item_orders must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update order for each item
        for item_order in item_orders:
            item_id = item_order.get("id")
            order = item_order.get("order")

            if item_id is not None and order is not None:
                try:
                    item = value_list.items.get(id=item_id)
                    item.order = order
                    item.save()
                except ValueListItem.DoesNotExist:
                    continue

        return Response({"message": "Items reordered successfully"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_value_lists_for_field(request):
    """Get value lists that can be used for selection fields"""
    value_lists = ValueList.objects.filter(is_active=True).order_by("name")

    result = []
    for value_list in value_lists:
        result.append(
            {
                "id": value_list.id,
                "name": value_list.name,
                "slug": value_list.slug,
                "value_type": value_list.value_type,
                "item_count": value_list.item_count,
                "items": value_list.get_items_list(),
            }
        )

    return Response({"value_lists": result, "count": len(result)})


# @api_view(["POST"])
# @permission_classes([IsAuthenticated])
def render_website_to_png_disabled(request):
    """
    Render an external website to PNG image.

    POST /api/v1/utils/render-website/

    Request body:
    {
        "url": "https://example.com",
        "viewport_width": 1920,  # optional
        "viewport_height": 1080,  # optional
        "full_page": false,      # optional
        "timeout": 30000         # optional, in milliseconds
    }

    Returns:
        - PNG image data as binary response with appropriate headers
        - Or JSON error response if rendering fails
    """
    try:
        # Get URL from request
        url = request.data.get("url")
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get optional configuration parameters
        custom_config = {}
        if "viewport_width" in request.data:
            custom_config["viewport_width"] = int(request.data["viewport_width"])
        if "viewport_height" in request.data:
            custom_config["viewport_height"] = int(request.data["viewport_height"])
        if "full_page" in request.data:
            custom_config["full_page"] = bool(request.data["full_page"])
        if "timeout" in request.data:
            custom_config["timeout"] = int(request.data["timeout"])

        logger.info(f"Rendering website to PNG: {url}")

        # Create renderer and render website
        renderer = WebsiteRenderer()
        try:
            png_bytes = renderer.render_website(url, custom_config)

            # Return PNG as binary response
            response = HttpResponse(png_bytes, content_type="image/png")
            response["Content-Disposition"] = (
                f'attachment; filename="website_screenshot.png"'
            )
            response["Content-Length"] = len(png_bytes)

            logger.info(f"Successfully rendered website: {url}")
            return response

        except WebsiteRenderingError as e:
            logger.warning(f"Website rendering failed for {url}: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    except ValueError as e:
        return Response(
            {"error": f"Invalid parameter value: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.error(f"Unexpected error rendering website {url}: {str(e)}")
        return Response(
            {"error": "An unexpected error occurred during website rendering"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def render_website_info_disabled(request):
    """
    Get information about rendering a website without actually rendering it.
    This endpoint validates the URL and returns configuration options.

    POST /api/v1/utils/render-website-info/

    Request body:
    {
        "url": "https://example.com"
    }

    Returns JSON with validation result and available options.
    """
    try:
        url = request.data.get("url")
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Create renderer to validate URL
        renderer = WebsiteRenderer()

        try:
            # This will raise WebsiteRenderingError if URL is invalid
            renderer._validate_url(url)

            return Response(
                {
                    "valid": True,
                    "url": url,
                    "message": "URL is valid and can be rendered",
                    "default_config": renderer.DEFAULT_CONFIG,
                    "available_options": {
                        "viewport_width": "Width of the browser viewport (default: 1920)",
                        "viewport_height": "Height of the browser viewport (default: 1080)",
                        "full_page": "Capture full page or just viewport (default: false)",
                        "timeout": "Maximum time to wait for page load in milliseconds (default: 30000)",
                    },
                }
            )

        except WebsiteRenderingError as e:
            return Response(
                {"valid": False, "url": url, "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        logger.error(f"Unexpected error validating website URL: {str(e)}")
        return Response(
            {"error": "An unexpected error occurred during URL validation"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class AIAgentTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing AI Agent tasks.

    Provides CRUD operations and additional actions for task management,
    including starting, stopping, and monitoring tasks.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return tasks for the current user."""
        return AIAgentTask.objects.filter(created_by=self.request.user)

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "create":
            return AIAgentTaskCreateSerializer
        return AIAgentTaskSerializer

    def perform_create(self, serializer):
        """Create and start a new AI agent task."""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a running or pending task."""
        task = self.get_object()

        if not task.is_active:
            return Response(
                {"error": "Task is not active and cannot be cancelled"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cancel the Celery task if it exists
        if task.celery_task_id:
            from celery import current_app

            current_app.control.revoke(task.celery_task_id, terminate=True)

        # Update task status
        task.status = "cancelled"
        task.save()

        # Send notification
        from .notifications import send_task_update

        send_task_update(
            str(task.id),
            {
                "type": "status",
                "status": "cancelled",
                "message": "Task cancelled by user",
            },
        )

        return Response({"message": "Task cancelled successfully"})

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        """Retry a failed or cancelled task."""
        task = self.get_object()

        if task.status not in ["failed", "cancelled"]:
            return Response(
                {"error": "Only failed or cancelled tasks can be retried"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reset task status
        task.status = "pending"
        task.progress = 0
        task.error_message = ""
        task.result_data = {}
        task.started_at = None
        task.completed_at = None
        task.actual_duration = None
        task.save()

        # Start new Celery task
        from .tasks import execute_ai_agent_task

        celery_task = execute_ai_agent_task.delay(str(task.id))
        task.celery_task_id = celery_task.id
        task.save(update_fields=["celery_task_id"])

        return Response({"message": "Task retry started successfully"})

    @action(detail=True, methods=["get"])
    def updates(self, request, pk=None):
        """Get all updates for a task."""
        task = self.get_object()
        updates = task.updates.all().order_by("timestamp")

        from .serializers import AIAgentTaskUpdateSerializer

        serializer = AIAgentTaskUpdateSerializer(updates, many=True)

        return Response(
            {
                "task_id": str(task.id),
                "updates": serializer.data,
                "count": updates.count(),
            }
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get all active tasks for the current user."""
        active_tasks = self.get_queryset().filter(status__in=["pending", "running"])
        serializer = self.get_serializer(active_tasks, many=True)
        return Response({"tasks": serializer.data, "count": active_tasks.count()})

    @action(detail=False, methods=["get"])
    def recent(self, request):
        """Get recent tasks for the current user."""
        recent_tasks = self.get_queryset().order_by("-created_at")[:10]
        serializer = self.get_serializer(recent_tasks, many=True)
        return Response({"tasks": serializer.data, "count": recent_tasks.count()})


class AIAgentTaskTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing AI Agent task templates.
    """

    serializer_class = AIAgentTaskTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return active templates for all users."""
        return AIAgentTaskTemplate.objects.filter(is_active=True)

    def perform_create(self, serializer):
        """Create a new template."""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def create_task(self, request, pk=None):
        """Create a new task from this template."""
        template = self.get_object()

        serializer = AIAgentTaskFromTemplateSerializer(
            data=request.data, context={"request": request}
        )

        if serializer.is_valid():
            # Set the template ID
            serializer.validated_data["template_id"] = template.id
            serializer.template = template

            task = serializer.create(serializer.validated_data)

            return Response(
                AIAgentTaskSerializer(task).data, status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        """Get most popular templates by usage."""
        popular_templates = self.get_queryset().order_by("-usage_count")[:10]
        serializer = self.get_serializer(popular_templates, many=True)
        return Response(
            {"templates": serializer.data, "count": popular_templates.count()}
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def validate_task_config(request):
    """
    Validate a task configuration without creating the task.

    POST /api/v1/utils/validate-task-config/

    Request body:
    {
        "task_type": "summary",
        "task_config": {
            "urls": ["https://example.com"],
            "max_length": 500
        }
    }
    """
    serializer = TaskConfigValidationSerializer(data=request.data)

    if serializer.is_valid():
        return Response(
            {
                "valid": True,
                "message": "Task configuration is valid",
                "task_type": serializer.validated_data["task_type"],
                "config": serializer.validated_data["task_config"],
            }
        )

    return Response(
        {"valid": False, "errors": serializer.errors},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_statistics(request):
    """
    Get task statistics for the current user.

    GET /api/v1/utils/task-statistics/
    """
    user_tasks = AIAgentTask.objects.filter(created_by=request.user)

    stats = {
        "total_tasks": user_tasks.count(),
        "pending_tasks": user_tasks.filter(status="pending").count(),
        "running_tasks": user_tasks.filter(status="running").count(),
        "completed_tasks": user_tasks.filter(status="completed").count(),
        "failed_tasks": user_tasks.filter(status="failed").count(),
        "cancelled_tasks": user_tasks.filter(status="cancelled").count(),
    }

    # Task type breakdown
    task_types = {}
    for task_type, label in AIAgentTask.TASK_TYPE_CHOICES:
        task_types[task_type] = {
            "label": label,
            "count": user_tasks.filter(task_type=task_type).count(),
        }

    # Recent activity (last 7 days)
    from django.utils import timezone
    from datetime import timedelta

    week_ago = timezone.now() - timedelta(days=7)
    recent_tasks = user_tasks.filter(created_at__gte=week_ago)

    return Response(
        {
            "statistics": stats,
            "task_types": task_types,
            "recent_activity": {"count": recent_tasks.count(), "period": "7 days"},
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_sse_stream(request, task_id):
    """
    Server-Sent Events endpoint for real-time task updates.

    GET /api/v1/utils/tasks/{task_id}/stream/
    """
    from django.http import StreamingHttpResponse
    from .notifications import SSETaskNotificationView

    try:
        # Verify task exists and user has access
        task = get_object_or_404(AIAgentTask, id=task_id, created_by=request.user)

        # Create SSE stream
        sse_view = SSETaskNotificationView(request.user.id, task_id)

        response = StreamingHttpResponse(
            sse_view.get_event_stream(), content_type="text/event-stream"
        )

        # Set headers for SSE
        response["Cache-Control"] = "no-cache"
        response["Connection"] = "keep-alive"
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Headers"] = "Cache-Control"

        return response

    except Exception as e:
        logger.error(f"SSE stream error for task {task_id}: {e}")
        return Response(
            {"error": "Failed to establish SSE stream"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def render_website_to_png(request):
    """
    Render an external website to PNG image.

    POST /api/v1/utils/render-website/

    Request body:
    {
        "url": "https://example.com",
        "viewport_width": 1920,  # optional
        "viewport_height": 1080,  # optional
        "full_page": false,      # optional
        "timeout": 30000         # optional, in milliseconds
    }

    Returns:
        - PNG image data as binary response with appropriate headers
        - Or JSON error response if rendering fails
    """
    try:
        # Get URL from request
        url = request.data.get("url")
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get optional configuration parameters
        custom_config = {}
        if "viewport_width" in request.data:
            custom_config["viewport_width"] = int(request.data["viewport_width"])
        if "viewport_height" in request.data:
            custom_config["viewport_height"] = int(request.data["viewport_height"])
        if "full_page" in request.data:
            custom_config["full_page"] = bool(request.data["full_page"])
        if "timeout" in request.data:
            custom_config["timeout"] = int(request.data["timeout"])

        logger.info(f"Rendering website to PNG: {url}")

        # Create renderer and render website
        renderer = WebsiteRenderer()
        try:
            png_bytes = renderer.render_website(url, custom_config)

            # Return PNG as binary response
            response = HttpResponse(png_bytes, content_type="image/png")
            response["Content-Disposition"] = (
                f'attachment; filename="website_screenshot.png"'
            )
            response["Content-Length"] = len(png_bytes)

            logger.info(f"Successfully rendered website: {url}")
            return response

        except WebsiteRenderingError as e:
            logger.warning(f"Website rendering failed for {url}: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    except ValueError as e:
        return Response(
            {"error": f"Invalid parameter value: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.error(f"Unexpected error rendering website {url}: {str(e)}")
        return Response(
            {"error": "An unexpected error occurred during website rendering"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def render_website_info(request):
    """
    Get information about rendering a website without actually rendering it.
    This endpoint validates the URL and returns configuration options.

    POST /api/v1/utils/render-website-info/

    Request body:
    {
        "url": "https://example.com"
    }

    Returns JSON with validation result and available options.
    """
    try:
        url = request.data.get("url")
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Create renderer to validate URL
        renderer = WebsiteRenderer()

        try:
            # This will raise WebsiteRenderingError if URL is invalid
            renderer._validate_url(url)

            return Response(
                {
                    "valid": True,
                    "url": url,
                    "message": "URL is valid and can be rendered",
                    "default_config": renderer.DEFAULT_CONFIG,
                    "available_options": {
                        "viewport_width": "Width of the browser viewport (default: 1920)",
                        "viewport_height": "Height of the browser viewport (default: 1080)",
                        "full_page": "Capture full page or just viewport (default: false)",
                        "timeout": "Maximum time to wait for page load in milliseconds (default: 30000)",
                    },
                }
            )

        except WebsiteRenderingError as e:
            return Response(
                {"valid": False, "url": url, "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        logger.error(f"Unexpected error validating website URL: {str(e)}")
        return Response(
            {"error": "An unexpected error occurred during URL validation"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
