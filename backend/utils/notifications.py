"""
Real-time notification system for AI Agent tasks.

This module handles sending real-time updates to the frontend using
WebSocket connections or Server-Sent Events (SSE).
"""

import json
import logging
from typing import Dict, Any, Optional
from django.core.cache import cache
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


class TaskNotificationManager:
    """
    Manager for sending real-time task notifications to connected clients.
    """

    def __init__(self):
        self.channel_layer = get_channel_layer()

    def send_to_user(self, user_id: int, message: Dict[str, Any]):
        """Send notification to a specific user."""
        if not self.channel_layer:
            logger.warning("Channel layer not configured - notifications disabled")
            return

        group_name = f"user_{user_id}"

        try:
            async_to_sync(self.channel_layer.group_send)(
                group_name, {"type": "task_notification", "message": message}
            )
            logger.debug(f"Sent notification to user {user_id}: {message['type']}")
        except Exception as e:
            logger.error(f"Failed to send notification to user {user_id}: {e}")

    def send_to_task_subscribers(self, task_id: str, message: Dict[str, Any]):
        """Send notification to all subscribers of a specific task."""
        if not self.channel_layer:
            logger.warning("Channel layer not configured - notifications disabled")
            return

        group_name = f"task_{task_id}"

        try:
            async_to_sync(self.channel_layer.group_send)(
                group_name, {"type": "task_notification", "message": message}
            )
            logger.debug(
                f"Sent notification to task {task_id} subscribers: {message['type']}"
            )
        except Exception as e:
            logger.error(f"Failed to send notification for task {task_id}: {e}")


# Global notification manager instance
notification_manager = TaskNotificationManager()


def send_task_update(task_id: str, update_data: Dict[str, Any]):
    """
    Send a task update notification to all relevant subscribers.

    Args:
        task_id: The UUID of the AI agent task
        update_data: The update data to send
    """
    from .models import AIAgentTask

    try:
        task = AIAgentTask.objects.get(id=task_id)

        # Prepare notification message
        message = {
            "task_id": str(task_id),
            "task_title": task.title,
            "task_type": task.task_type,
            "status": task.status,
            "progress": task.progress,
            "update": update_data,
            "timestamp": update_data.get("timestamp"),
        }

        # Send to task owner
        notification_manager.send_to_user(task.created_by.id, message)

        # Send to task-specific subscribers
        notification_manager.send_to_task_subscribers(str(task_id), message)

        # Cache the latest update for new connections
        cache_key = f"task_latest_update_{task_id}"
        cache.set(cache_key, message, timeout=3600)  # Cache for 1 hour

    except AIAgentTask.DoesNotExist:
        logger.error(f"Task {task_id} not found when sending notification")
    except Exception as e:
        logger.error(f"Failed to send task update for {task_id}: {e}")


def get_cached_task_update(task_id: str) -> Optional[Dict[str, Any]]:
    """Get the latest cached update for a task."""
    cache_key = f"task_latest_update_{task_id}"
    return cache.get(cache_key)


class SSETaskNotificationView:
    """
    Server-Sent Events view for real-time task notifications.

    This provides a fallback for clients that don't support WebSockets.
    """

    def __init__(self, user_id: int, task_id: Optional[str] = None):
        self.user_id = user_id
        self.task_id = task_id
        self.connection_key = f"sse_connection_{user_id}_{task_id or 'all'}"

    def get_event_stream(self):
        """Generator that yields SSE-formatted events."""
        import time

        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'timestamp': time.time()})}\n\n"

        # If specific task requested, send cached update
        if self.task_id:
            cached_update = get_cached_task_update(self.task_id)
            if cached_update:
                yield f"data: {json.dumps(cached_update)}\n\n"

        # Keep connection alive and check for updates
        last_check = time.time()

        while True:
            # Check for new updates in cache
            if self.task_id:
                cache_key = f"sse_updates_{self.task_id}_{last_check}"
                updates = cache.get(cache_key, [])

                for update in updates:
                    yield f"data: {json.dumps(update)}\n\n"

            # Send heartbeat every 30 seconds
            if time.time() - last_check > 30:
                yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': time.time()})}\n\n"
                last_check = time.time()

            time.sleep(1)


def cache_sse_update(task_id: str, update_data: Dict[str, Any]):
    """Cache an update for SSE clients."""
    import time

    timestamp = time.time()
    cache_key = f"sse_updates_{task_id}_{timestamp}"

    # Get existing updates
    existing_updates = cache.get(cache_key, [])
    existing_updates.append(update_data)

    # Cache for 5 minutes
    cache.set(cache_key, existing_updates, timeout=300)


# WebSocket Consumer for real-time notifications
try:
    from channels.generic.websocket import AsyncWebsocketConsumer

    class TaskNotificationConsumer(AsyncWebsocketConsumer):
        """
        WebSocket consumer for real-time AI agent task notifications.
        """

        async def connect(self):
            """Handle WebSocket connection."""
            self.user = self.scope["user"]

            if not self.user.is_authenticated:
                await self.close()
                return

            # Join user-specific group
            self.user_group_name = f"user_{self.user.id}"
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)

            await self.accept()

            # Send connection confirmation
            await self.send(
                text_data=json.dumps(
                    {"type": "connected", "message": "Connected to task notifications"}
                )
            )

        async def disconnect(self, close_code):
            """Handle WebSocket disconnection."""
            if hasattr(self, "user_group_name"):
                await self.channel_layer.group_discard(
                    self.user_group_name, self.channel_name
                )

            # Leave any task-specific groups
            if hasattr(self, "task_groups"):
                for group in self.task_groups:
                    await self.channel_layer.group_discard(group, self.channel_name)

        async def receive(self, text_data):
            """Handle messages from WebSocket."""
            try:
                data = json.loads(text_data)
                message_type = data.get("type")

                if message_type == "subscribe_task":
                    await self.subscribe_to_task(data.get("task_id"))
                elif message_type == "unsubscribe_task":
                    await self.unsubscribe_from_task(data.get("task_id"))

            except json.JSONDecodeError:
                await self.send(
                    text_data=json.dumps({"type": "error", "message": "Invalid JSON"})
                )

        async def subscribe_to_task(self, task_id: str):
            """Subscribe to updates for a specific task."""
            if not task_id:
                return

            group_name = f"task_{task_id}"

            # Check if user has access to this task
            from .models import AIAgentTask

            try:
                task = await AIAgentTask.objects.aget(id=task_id)
                if task.created_by_id != self.user.id:
                    await self.send(
                        text_data=json.dumps(
                            {"type": "error", "message": "Access denied to task"}
                        )
                    )
                    return
            except AIAgentTask.DoesNotExist:
                await self.send(
                    text_data=json.dumps({"type": "error", "message": "Task not found"})
                )
                return

            # Join task group
            await self.channel_layer.group_add(group_name, self.channel_name)

            # Track subscribed groups
            if not hasattr(self, "task_groups"):
                self.task_groups = set()
            self.task_groups.add(group_name)

            # Send cached update if available
            cached_update = get_cached_task_update(task_id)
            if cached_update:
                await self.send(text_data=json.dumps(cached_update))

            await self.send(
                text_data=json.dumps({"type": "subscribed", "task_id": task_id})
            )

        async def unsubscribe_from_task(self, task_id: str):
            """Unsubscribe from task updates."""
            if not task_id:
                return

            group_name = f"task_{task_id}"
            await self.channel_layer.group_discard(group_name, self.channel_name)

            if hasattr(self, "task_groups"):
                self.task_groups.discard(group_name)

            await self.send(
                text_data=json.dumps({"type": "unsubscribed", "task_id": task_id})
            )

        async def task_notification(self, event):
            """Handle task notification from group."""
            message = event["message"]
            await self.send(text_data=json.dumps(message))

except ImportError:
    # Channels not installed - WebSocket support disabled
    logger.warning("Django Channels not installed - WebSocket notifications disabled")
    TaskNotificationConsumer = None
