"""
Development Auto-Login Middleware

SECURITY WARNING: This middleware is ONLY active when DEBUG=True
Never deploy to production with DEBUG=True!
"""

from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()


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
        if settings.DEBUG:
            # Check if user is already authenticated via session or other means
            if not hasattr(request, "user") or request.user.is_anonymous:
                # Get or create dev user on first request
                if self.dev_user is None:
                    self.dev_user = self._get_or_create_dev_user()

                # Automatically authenticate the request
                if self.dev_user:
                    request.user = self.dev_user
                    request._cached_user = self.dev_user

        response = self.get_response(request)
        return response

    def _get_or_create_dev_user(self):
        """
        Get or create the development user.

        Returns:
            User object or None if creation fails
        """
        try:
            user = User.objects.get(username="dev_auto_user")
            return user
        except User.DoesNotExist:
            try:
                user = User.objects.create_user(
                    username="dev_auto_user",
                    email="dev@localhost.local",
                    password="dev123",
                    first_name="Dev",
                    last_name="User",
                    is_staff=True,
                    is_superuser=True,
                )
                print(f"[DevAutoLoginMiddleware] Created dev user: {user.username}")
                return user
            except Exception as e:
                print(f"[DevAutoLoginMiddleware] Failed to create dev user: {e}")
                return None
        except Exception as e:
            print(f"[DevAutoLoginMiddleware] Error getting dev user: {e}")
            return None
