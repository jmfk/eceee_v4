"""Shared HTTP, token and WebSocket revocation checks."""

from allauth.account.authentication import get_authentication_records
from allauth.mfa.models import Authenticator
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.utils import timezone

from .models import AccountSecurity

SESSION_VERSION = "cms_security_version"
SESSION_MFA = "cms_mfa_verified"


def security_state(user):
    return AccountSecurity.objects.filter(user_id=user.pk).first()


def security_version(user):
    state = security_state(user)
    return state.version if state else 0


def has_mfa(user):
    return Authenticator.objects.filter(user_id=user.pk).exists()


def session_is_valid(user, session):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if session.get(SESSION_VERSION, 0) != security_version(user):
        return False
    return not has_mfa(user) or session.get(SESSION_MFA) is True


def stamp_session(request, user, *, mfa=None):
    request.session[SESSION_VERSION] = security_version(user)
    if mfa is None:
        mfa = any(record.get("method") == "mfa" for record in get_authentication_records(request))
    request.session[SESSION_MFA] = bool(mfa)


def revoke_credentials(user, request=None, *, factor_proven=False):
    # Lock the stable user row as the state row need not exist on upgraded accounts.
    from django.contrib.auth import get_user_model

    with transaction.atomic():
        get_user_model()._default_manager.select_for_update().get(pk=user.pk)
        state, _ = AccountSecurity.objects.get_or_create(user_id=user.pk)
        preserve_session = (
            request
            and request.user.is_authenticated
            and request.user.pk == user.pk
            and request.session.get(SESSION_VERSION, 0) == state.version
        )
        state.version += 1
        state.changed_at = timezone.now()
        state.save(update_fields=["version", "changed_at"])
        # A request that started before another revocation must not promote its
        # stale session to the new version, even if its own mutation completes.
        if preserve_session:
            stamp_session(request, user, mfa=factor_proven or request.session.get(SESSION_MFA, False))
    return state.version


def invalidate_session_user(request):
    # Leave pending allauth state and OAuth state intact; the login endpoint can
    # safely restart the session. Never expose a stale identity to tenant selection.
    request.user = AnonymousUser()
    request._cached_user = request.user


def recently_verified(request):
    import time

    from django.conf import settings

    if not request.user.is_authenticated:
        return False
    method = "mfa" if has_mfa(request.user) else "password"
    return any(
        record.get("method") == method
        and record.get("reauthenticated")
        and time.time() - record.get("at", 0) < settings.ACCOUNT_REAUTHENTICATION_TIMEOUT
        for record in get_authentication_records(request)
    )


def websocket_session_is_valid(user, scope):
    from django.conf import settings
    from django.utils.crypto import constant_time_compare

    if settings.DEBUG and getattr(settings, "DEV_AUTO_LOGIN", True) and scope.get("cms_dev_auto_login"):
        return bool(user and user.is_active)
    session = scope.get("session")
    if session is None or not session.session_key:
        return False
    # Reload instead of trusting the copy captured at WebSocket connection time.
    from importlib import import_module

    live = import_module(settings.SESSION_ENGINE).SessionStore(session_key=session.session_key)
    return (
        live.get("_auth_user_id") == str(user.pk)
        and constant_time_compare(live.get("_auth_user_hash", ""), user.get_session_auth_hash())
        and session_is_valid(user, live)
    )
