"""
Development Auto-Login Middleware

SECURITY WARNING: This middleware is ONLY active when DEBUG=True
Never deploy to production with DEBUG=True!
"""

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


def get_or_create_dev_user():
    """Return the development user shared by HTTP and WebSocket auth."""
    try:
        return User.objects.get(username="dev_auto_user")
    except User.DoesNotExist:
        try:
            return User.objects.create_user(
                username="dev_auto_user",
                email="dev@localhost.local",
                password="dev123",
                first_name="Dev",
                last_name="User",
                is_staff=True,
                is_superuser=True,
            )
        except Exception:
            return None
    except Exception:
        return None


class DevAutoLoginMiddleware:
    """
    Middleware to automatically log in a dev user when DEBUG=True.

    SECURITY: Only active in development mode (DEBUG=True)

    This allows browser-based testing without manual login during development.
    The middleware checks for the dev_auto_user and authenticates all requests
    with that user when DEBUG mode is enabled.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.dev_user = None

    def __call__(self, request):
        # CRITICAL: Only activate in DEBUG mode
        if settings.DEBUG and getattr(settings, "DEV_AUTO_LOGIN", True):
            # Check if user is already authenticated via session or other means
            if not hasattr(request, "user") or request.user.is_anonymous:
                # Get or create dev user on first request
                if self.dev_user is None:
                    self.dev_user = self._get_or_create_dev_user()

                # Automatically authenticate the request
                if self.dev_user:
                    request.user = self.dev_user
                    request._cached_user = self.dev_user
                    request.cms_dev_auto_login = True

        response = self.get_response(request)
        return response

    def _get_or_create_dev_user(self):
        """
        Get or create the development user.

        Returns:
            User object or None if creation fails
        """
        return get_or_create_dev_user()


class DevAutoLoginASGIMiddleware:
    """Apply the same DEBUG-only development identity to WebSocket scopes."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if settings.DEBUG and getattr(settings, "DEV_AUTO_LOGIN", True) and scope.get("type") == "websocket":
            user = scope.get("user")
            if not user or not user.is_authenticated:
                dev_user = await database_sync_to_async(get_or_create_dev_user)()
                if dev_user:
                    scope = dict(scope)
                    scope["user"] = dev_user
                    scope["cms_dev_auto_login"] = True

        return await self.inner(scope, receive, send)
