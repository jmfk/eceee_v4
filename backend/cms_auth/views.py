from allauth.account.models import EmailAddress
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .security import has_mfa, session_is_valid


@require_GET
def security_status(request):
    if not session_is_valid(request.user, request.session) or request.headers.get("Authorization"):
        return JsonResponse({"detail": "Browser sign-in required."}, status=401)
    response = JsonResponse(
        {
            "mfaEnabled": has_mfa(request.user),
            "mfaConfigured": bool(settings.CMS_MFA_ENCRYPTION_KEYS),
            "emailVerified": EmailAddress.objects.filter(
                user=request.user, email__iexact=request.user.email, verified=True
            ).exists(),
        }
    )
    response["Cache-Control"] = "no-store"
    return response


@require_GET
def recent_authentication(request):
    return JsonResponse({"status": 200})
