"""Short-lived read tickets for native browser media and WebSocket APIs.

Browsers cannot attach the app's JWT header to <video>, <img>, or WebSocket.
Tickets are signed, tenant/user bound, read-only and recheck live membership.
"""

from django.contrib.auth.models import User
from django.core import signing
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from cms_auth.security import security_version
from core.models import Tenant

from .services import can_access

SALT = "kanban.browser.read.v1"
MAX_AGE = 900


def issue_ticket(user, tenant):
    return signing.TimestampSigner(salt=SALT, sep=".").sign_object(
        {"user": user.pk, "tenant": str(tenant.pk), "security_version": security_version(user)}
    )


def resolve_ticket(ticket):
    try:
        data = signing.TimestampSigner(salt=SALT, sep=".").unsign_object(ticket, max_age=MAX_AGE)
        user = User.objects.get(pk=data["user"], is_active=True)
        tenant = Tenant.objects.get(pk=data["tenant"], is_active=True)
        if data.get("security_version", 0) != security_version(user) or not can_access(user, tenant):
            raise ValueError
        return user, tenant
    except (signing.BadSignature, User.DoesNotExist, Tenant.DoesNotExist, KeyError, ValueError, TypeError) as exc:
        raise AuthenticationFailed("Browser access expired. Reload this page.") from exc


class AttachmentTicketAuthentication(BaseAuthentication):
    def authenticate(self, request):
        ticket = request.query_params.get("ticket")
        if not ticket:
            return None
        if request.method not in {"GET", "HEAD"} or not request.path.rstrip("/").endswith("/download"):
            raise AuthenticationFailed("Browser tickets are read-only download credentials.")
        user, tenant = resolve_ticket(ticket)
        request.tenant = tenant
        return user, None
