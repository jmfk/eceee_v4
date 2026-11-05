"""Bounded user impersonation without replacing the real browser login."""

import json
import logging
import time

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from rest_framework import serializers

from .security import security_version, session_is_valid

logger = logging.getLogger(__name__)
SESSION_KEY = "cms_user_perspective"
CONTROL_PATH = "/api/v1/utils/user-perspective/"
CURRENT_USER_PATH = "/api/v1/utils/current-user/"
DURATION = 30 * 60


class PerspectiveSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)


def metadata(record, *, expired=False):
    return {
        "userId": record["user_id"],
        "username": record["username"],
        "expiresAt": record["expires_at"],
        "readOnly": False,
        "expired": expired,
    }


def valid_actor(request):
    actor = getattr(request, "perspective_actor", request.user)
    return bool(
        not request.headers.get("Authorization")
        and actor.is_authenticated
        and actor.is_superuser
        and session_is_valid(actor, request.session)
    )


@csrf_protect
@require_http_methods(["POST", "DELETE"])
def user_perspective(request):
    if not valid_actor(request):
        return JsonResponse({"detail": "A system owner's browser sign-in is required."}, status=403)
    actor = getattr(request, "perspective_actor", request.user)
    record = request.session.get(SESSION_KEY)
    if request.method == "DELETE":
        if record:
            if record["actor_id"] != actor.pk:
                return JsonResponse({"detail": "The original administrator must sign in again."}, status=403)
            request.session.pop(SESSION_KEY)
            original_workspace = record.get("original_workspace")
            if original_workspace:
                request.session["selected_tenant_identifier"] = original_workspace
            else:
                request.session.pop("selected_tenant_identifier", None)
            request.session.cycle_key()
            logger.info("User perspective stopped actor_id=%s target_id=%s", actor.pk, record["user_id"])
        response = JsonResponse({"active": False})
    else:
        if record:
            return JsonResponse({"detail": "Return to your own account before viewing another user."}, status=409)
        try:
            payload = json.loads(request.body)
        except (ValueError, UnicodeDecodeError):
            return JsonResponse({"detail": "Choose an existing user."}, status=400)
        # This plain Django endpoint explicitly bridges the frontend-owned camelCase input.
        serializer = PerspectiveSerializer(data={"user_id": payload.get("userId")} if isinstance(payload, dict) else {})
        if not serializer.is_valid():
            return JsonResponse({"detail": "Choose an existing user."}, status=400)
        target = get_user_model().objects.filter(pk=serializer.validated_data["user_id"], is_active=True).first()
        if not target or target.pk == actor.pk or target.is_superuser:
            return JsonResponse({"detail": "Choose an active user who is not a system owner."}, status=400)
        record = {
            "actor_id": actor.pk,
            "user_id": target.pk,
            "username": target.get_username(),
            "security_version": security_version(target),
            "expires_at": int(time.time()) + DURATION,
            "original_workspace": request.session.get("selected_tenant_identifier"),
        }
        request.session[SESSION_KEY] = record
        request.session.pop("selected_tenant_identifier", None)
        request.session.cycle_key()
        logger.info("User perspective started actor_id=%s target_id=%s", actor.pk, target.pk)
        response = JsonResponse({"active": True, "userPerspective": metadata(record)})
    response["Cache-Control"] = "no-store"
    return response


class UserPerspectiveMiddleware:
    """Resolve the effective user before tenant selection; fail closed until explicit exit."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        record = request.session.get(SESSION_KEY)
        if request.path == "/csrf-token/" and request.method == "GET":
            return self.get_response(request)
        if not record:
            return self.get_response(request)
        request.perspective_actor = request.user
        if not valid_actor(request) or record["actor_id"] != request.user.pk:
            if not request.headers.get("Authorization") and request.path.startswith(("/_allauth/", "/accounts/")):
                # A revoked original login must still be able to complete normal sign-in/MFA.
                request.session.pop(SESSION_KEY, None)
                return self.get_response(request)
            return JsonResponse({"detail": "The original administrator must sign in again."}, status=401)
        if request.path == CONTROL_PATH:
            return self.get_response(request)
        target = get_user_model().objects.filter(pk=record["user_id"]).first()
        expired = bool(
            time.time() >= record["expires_at"]
            or not target
            or not target.is_active
            or target.is_superuser
            or security_version(target) != record["security_version"]
        )
        request.user_perspective = metadata(record, expired=expired)
        if expired:
            if request.path == CURRENT_USER_PATH and request.method == "GET":
                # Keep an exit route visible without returning the administrator's data/privileges.
                return JsonResponse(
                    {
                        "id": record["user_id"],
                        "username": record["username"],
                        "isSuperuser": False,
                        "permissions": [],
                        "designerTenants": [],
                        "userPerspective": request.user_perspective,
                    },
                    headers={"Cache-Control": "no-store"},
                )
            return JsonResponse({"detail": "User perspective has ended. Return to your own account."}, status=403)
        if request.path.startswith(("/_allauth/", "/accounts/", "/api/v1/auth/", "/api/auth/", "/admin/")):
            return JsonResponse(
                {"detail": "Account sign-in and security are unavailable in user perspective."}, status=403
            )
        if request.path.startswith("/api/v1/utils/change-password/"):
            return JsonResponse({"detail": "Return to your account before managing account security."}, status=403)
        request.user = target
        request._cached_user = target
        response = self.get_response(request)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            logger.info(
                "User perspective action actor_id=%s target_id=%s method=%s path=%s status=%s",
                record["actor_id"],
                target.pk,
                request.method,
                request.path,
                response.status_code,
            )
        response["Cache-Control"] = "no-store"
        return response


def websocket_target(actor, session):
    """Resolve a live delegation without creating a login/MFA record for the target."""
    record = session.get(SESSION_KEY) if session is not None else None
    if not record or not actor or not actor.is_superuser or not session_is_valid(actor, session):
        return None
    if record["actor_id"] != actor.pk or time.time() >= record["expires_at"]:
        return None
    target = get_user_model().objects.filter(pk=record["user_id"], is_active=True, is_superuser=False).first()
    if target and security_version(target) == record["security_version"]:
        return target
    return None
