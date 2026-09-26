"""Encrypt outbound remote credentials and authenticate scoped inbound keys."""

import base64
import hashlib
import secrets

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.utils import timezone
from rest_framework import authentication, exceptions

from webpages.models import ThemeRemoteAccessKey


class RemoteCredentialConfigurationError(RuntimeError):
    pass


def _cipher():
    configured = list(getattr(settings, "THEME_REMOTE_CREDENTIAL_KEYS", []))
    if not configured and settings.DEBUG:
        configured = [base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode()]
    if not configured:
        raise RemoteCredentialConfigurationError("Remote credential encryption is not configured.")
    try:
        return MultiFernet([Fernet(key.encode()) for key in configured])
    except (TypeError, ValueError) as exc:
        raise RemoteCredentialConfigurationError("Remote credential encryption is invalid.") from exc


def encrypt_access_key(value):
    return _cipher().encrypt(value.encode()).decode()


def decrypt_access_key(value):
    try:
        return _cipher().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RemoteCredentialConfigurationError("The saved remote credential cannot be decrypted.") from exc


def generate_access_key():
    value = f"eceee_theme_{secrets.token_urlsafe(32)}"
    return value, hashlib.sha256(value.encode()).hexdigest(), value[:12]


class ThemeRemoteAccessKeyAuthentication(authentication.BaseAuthentication):
    keyword = b"ThemeKey"

    def authenticate(self, request):
        parts = authentication.get_authorization_header(request).split()
        if not parts or parts[0] != self.keyword:
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Invalid remote theme access key.")
        digest = hashlib.sha256(parts[1]).hexdigest()
        try:
            access_key = ThemeRemoteAccessKey.objects.select_related("tenant", "created_by").get(
                key_hash=digest,
                is_active=True,
            )
        except ThemeRemoteAccessKey.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Invalid remote theme access key.") from exc
        if not access_key.created_by.is_active or getattr(request, "tenant", None) != access_key.tenant:
            raise exceptions.AuthenticationFailed("Invalid remote theme access key.")
        ThemeRemoteAccessKey.objects.filter(pk=access_key.pk).update(last_used_at=timezone.now())
        return access_key.created_by, access_key

    def authenticate_header(self, request):
        return self.keyword.decode()
