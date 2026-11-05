from django.conf import settings
from django.db import models


class AccountSecurity(models.Model):
    """Revocation state for human credentials; never confers tenant access."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True)
    version = models.PositiveBigIntegerField(default=0)
    changed_at = models.DateTimeField(null=True, blank=True)


class UserLanguagePreference(models.Model):
    """Optional CMS interface language override; an empty value follows the browser."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True)
    language = models.CharField(max_length=5, blank=True, default="")


class UserPerspectiveSession(models.Model):
    """Delegation follows a real login without rewriting its cookie or session payload."""

    session = models.OneToOneField(
        "sessions.Session", on_delete=models.CASCADE, primary_key=True, related_name="user_perspective"
    )
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    target = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    target_username = models.CharField(max_length=150)
    target_security_version = models.PositiveBigIntegerField(default=0)
    expires_at = models.DateTimeField()
    original_workspace = models.CharField(max_length=100, blank=True, default="")
    nonce = models.UUIDField()
    active = models.BooleanField(default=True)
