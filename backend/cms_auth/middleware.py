import time

from django.conf import settings
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from .security import invalidate_session_user, recently_verified, session_is_valid


class AccountSecurityMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.user.is_authenticated and not session_is_valid(request.user, request.session):
            invalidate_session_user(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        path = request.path
        if not path.startswith("/_allauth/"):
            return None
        if request.headers.get("Authorization"):
            return JsonResponse({"status": 403, "errors": [{"message": "Use a personal browser session."}]}, status=403)
        sensitive = path.startswith("/_allauth/browser/v1/account/authenticators/")
        sensitive |= path.endswith("/account/reauthenticated")
        sensitive |= path.endswith("/account/email") and request.method != "GET"
        sensitive |= path.endswith("/account/providers") and request.method == "DELETE"
        connecting = False
        if path.endswith("/auth/provider/redirect"):
            connecting = request.POST.get("process") == "connect"
            sensitive |= connecting
        # Renaming/removing factors and retrieving enrollment secrets require the
        # same freshness as activating them; library defaults alone don't cover it.
        if sensitive:
            if not request.user.is_authenticated:
                return JsonResponse({"status": 401, "meta": {"is_authenticated": False}}, status=401)
            fresh = recently_verified(request)
            if not fresh:
                from allauth.headless.base.response import ReauthenticationResponse

                # The normal browser decorator hasn't run yet.
                from allauth.headless.constants import Client
                from allauth.headless.internal.decorators import mark_request_as_headless

                mark_request_as_headless(request, Client.BROWSER)
                return ReauthenticationResponse(request)
            if ("/authenticators/totp" in path or "/authenticators/webauthn" in path) and request.method in {
                "GET",
                "POST",
            }:
                from allauth.account.models import EmailAddress

                if not EmailAddress.objects.filter(
                    user=request.user, email__iexact=request.user.email, verified=True
                ).exists():
                    return JsonResponse(
                        {
                            "status": 409,
                            "errors": [
                                {"message": "Verify your account email before enabling two-factor authentication."}
                            ],
                        },
                        status=409,
                    )
            if not settings.CMS_MFA_ENCRYPTION_KEYS and "/authenticators/" in path:
                return JsonResponse(
                    {
                        "status": 503,
                        "errors": [{"message": "Two-factor authentication is not configured. Contact the operator."}],
                    },
                    status=503,
                )
        if "/webauthn" in path and request.method in {"GET", "POST"}:
            if request.method == "GET":
                request.session["cms_webauthn_started"] = time.time()
            elif time.time() - request.session.pop("cms_webauthn_started", 0) > 300:
                request.session.pop("mfa.webauthn.state", None)
                return JsonResponse(
                    {"status": 409, "errors": [{"message": "Passkey challenge expired. Try again."}]}, status=409
                )
        # No passwordless registration, even if a caller manually adds a query flag.
        if path.endswith("/authenticators/webauthn") and "passwordless" in request.GET:
            return JsonResponse(
                {"status": 400, "errors": [{"message": "Passkeys are supported only as a second factor."}]}, status=400
            )
        return None

    def process_response(self, request, response):
        if request.path.startswith(("/_allauth/", "/api/v1/auth/", "/accounts/")):
            response["Cache-Control"] = "no-store"
            response["Referrer-Policy"] = "no-referrer"
        return response
