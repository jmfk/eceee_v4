"""A bounded, personal account export. Editorial content is owned by the tenant."""

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .security import session_is_valid


@require_GET
def account_export(request):
    if not session_is_valid(request.user, request.session) or request.headers.get("Authorization"):
        return JsonResponse({"detail": "Browser sign-in required."}, status=401)
    user = request.user
    from allauth.account.models import EmailAddress
    from django.apps import apps

    payload = {
        "exportedAt": timezone.now().isoformat(),
        "scope": "Account details and support messages written by this account. Tenant editorial content and third-party records are not included. Contact support for a complete data-access request.",
        "account": {
            "username": user.username,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "dateJoined": user.date_joined.isoformat(),
        },
        "emailAddresses": list(EmailAddress.objects.filter(user=user).values("email", "verified", "primary")),
    }
    # No credentials, authentication factors, session identifiers or other participants' messages.
    if apps.is_installed("tenant_support"):
        from tenant_support.models import Message

        messages = Message.objects.filter(sender=user).order_by("created_at", "id")
        # Keep the synchronous export bounded and report whether more records require support.
        rows = list(messages.values("id", "body", "created_at")[:10001])
        payload["supportMessages"] = rows[:10000]
        payload["supportMessagesTruncated"] = len(rows) > 10000
    response = JsonResponse(payload)
    response["Content-Disposition"] = 'attachment; filename="eceee-account-export.json"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
