from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.exceptions import AuthenticationFailed

from core.models import Tenant

from .access import resolve_ticket
from .services import can_access


class KanbanConsumer(AsyncJsonWebsocketConsumer):
    @database_sync_to_async
    def authorized(self):
        protocols = self.scope.get("subprotocols", [])
        if len(protocols) == 2 and protocols[0] == "kanban":
            try:
                user, tenant = resolve_ticket(protocols[1])
                return str(tenant.pk) == str(self.tenant_id) and can_access(user, tenant)
            except AuthenticationFailed:
                return False
        if not self.scope.get("user") or not self.scope["user"].is_authenticated:
            return False
        from cms_auth.security import websocket_session_is_valid

        if not websocket_session_is_valid(self.scope["user"], self.scope):
            return False
        tenant = Tenant.objects.filter(pk=self.tenant_id).first()
        return bool(tenant and can_access(self.scope.get("user"), tenant))

    async def connect(self):
        self.tenant_id = self.scope["url_route"]["kwargs"]["tenant_id"]
        self.group_name = f"kanban_{self.tenant_id}"
        self.joined = False
        if not await self.authorized():
            await self.close(code=4403)
            return
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        self.joined = True
        await self.accept(subprotocol="kanban" if "kanban" in self.scope.get("subprotocols", []) else None)

    async def disconnect(self, code):
        if getattr(self, "joined", False):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def kanban_changed(self, event):
        if not await self.authorized():
            await self.close(code=4403)
            return
        await self.send_json({"type": "kanban.changed"})
