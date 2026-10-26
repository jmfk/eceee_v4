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
