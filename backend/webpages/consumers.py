"""Tenant-authorized WebSocket notifications and advisory page-editor presence."""

import json
import uuid

from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import get_channel_layer

ALLOWED_EDITOR_SECTIONS = {"content", "slots", "settings", "publishing", "theme", "preview"}


class PageEditorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.page_id = self.scope["url_route"]["kwargs"]["page_id"]
        self.room_group_name = f"page_editor_{self.page_id}"
        self.connection_id = str(uuid.uuid4())
        self.joined_group = False
        self.section = "content"
        self.widget_id = None

        user = self.scope.get("user")
        if not user or not user.is_authenticated or not await self._can_access_page(user, self.page_id):
            await self.accept()
            await self.send(
                text_data=json.dumps(
                    {"type": "auth_failure", "message": "Page access is required", "code": "FORBIDDEN"}
                )
            )
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        self.joined_group = True
        await self.accept()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "connection_established",
                    "page_id": self.page_id,
                    "connection_id": self.connection_id,
                }
            )
        )
        await self._broadcast_presence("join")
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence_sync_request",
                "requester_connection_id": self.connection_id,
            },
        )

    async def disconnect(self, close_code):
        if not hasattr(self, "room_group_name") or not hasattr(self, "connection_id"):
            return
        if getattr(self, "channel_layer", None) and getattr(self, "joined_group", False):
            await self._broadcast_presence("leave")
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            self.joined_group = False

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except (TypeError, ValueError):
            return
        message_type = data.get("type")
        if message_type in {"presence_update", "presence_announce", "presence_heartbeat"}:
            section = data.get("section")
            self.section = section if section in ALLOWED_EDITOR_SECTIONS else "content"
            widget_id = data.get("widget_id")
            self.widget_id = str(widget_id)[:255] if widget_id else None
            action = "heartbeat" if message_type == "presence_heartbeat" else "update"
            await self._broadcast_presence(action)
        elif message_type == "presence_sync_request":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "presence_sync_request",
                    "requester_connection_id": self.connection_id,
                },
            )

    async def version_updated(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "version_updated",
                    "page_id": event["page_id"],
                    "version_id": event["version_id"],
                    "updated_at": event["updated_at"],
                    "revision": event.get("revision"),
                    "updated_by": event.get("updated_by"),
                    "session_id": event.get("session_id"),
                    "mutation_type": event.get("mutation_type", "saved"),
                }
            )
        )

    async def presence_event(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence",
                    "action": event["action"],
                    "page_id": event["page_id"],
                    "connection_id": event["connection_id"],
                    "user": event["user"],
                    "section": event["section"],
                    "widget_id": event["widget_id"],
                }
            )
        )

    async def presence_sync_request(self, event):
        requester = event.get("requester_connection_id")
        if requester == self.connection_id:
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_sync_request",
                    "requester_connection_id": requester,
                }
            )
        )

    async def _broadcast_presence(self, action):
        user = self.scope.get("user")
        display_name = user.get_full_name().strip() or user.username
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence_event",
                "action": action,
                "page_id": self.page_id,
                "connection_id": self.connection_id,
                "user": {"id": user.id, "username": user.username, "display_name": display_name},
                "section": self.section,
                "widget_id": self.widget_id,
            },
        )

    @database_sync_to_async
    def _can_access_page(self, user, page_id):
        from .models import WebPage

        page = WebPage.objects.select_related("tenant", "tenant__created_by").filter(pk=page_id).first()
        return bool(page and (user.is_staff or page.tenant.user_has_access(user)))


def broadcast_version_update(
    page_id,
    version_id,
    updated_at,
    revision=None,
    updated_by=None,
    session_id=None,
    mutation_type="saved",
):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"page_editor_{page_id}",
        {
            "type": "version_updated",
            "page_id": page_id,
            "version_id": version_id,
            "updated_at": updated_at,
            "revision": revision,
            "updated_by": updated_by,
            "session_id": session_id,
            "mutation_type": mutation_type,
        },
    )
