from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from .security import websocket_session_is_valid


class AccountSecurityASGIMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        user = scope.get("user")
        if user and user.is_authenticated:
            valid = await database_sync_to_async(websocket_session_is_valid)(user, scope)
            if not valid:
                scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)
