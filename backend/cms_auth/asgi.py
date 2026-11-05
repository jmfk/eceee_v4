from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from .security import session_is_valid, websocket_session_is_valid


class AccountSecurityASGIMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        user = scope.get("user")
        if user and user.is_authenticated:
            session = scope.get("session")
            record = await database_sync_to_async(session.get)("cms_user_perspective") if session is not None else None
            if record:
                valid = await database_sync_to_async(session_is_valid)(user, scope["session"])
            else:
                valid = await database_sync_to_async(websocket_session_is_valid)(user, scope)
            if not valid:
                scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)


class UserPerspectiveASGIMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        session = scope.get("session")
        record = await database_sync_to_async(session.get)("cms_user_perspective") if session is not None else None
        if record:
            from .impersonation import websocket_target

            scope = dict(scope)
            actor = scope.get("user")
            target = await database_sync_to_async(websocket_target)(actor, session)
            scope["cms_perspective_actor_id"] = actor.pk if actor and actor.is_authenticated else None
            scope["user"] = target or AnonymousUser()
        return await self.inner(scope, receive, send)
