"""Tenant-scoped access keys and saved connections for remote theme sync."""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class ThemeRemoteAccessKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE, related_name="theme_remote_access_keys")
    name = models.CharField(max_length=120)
    key_hash = models.CharField(max_length=64, unique=True, editable=False)
    key_prefix = models.CharField(max_length=12, editable=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_theme_remote_access_keys",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["tenant", "name"], name="unique_theme_remote_key_name")]


class ThemeRemoteConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE, related_name="theme_remote_connections")
    name = models.CharField(max_length=120)
    base_url = models.URLField(max_length=500)
    remote_workspace = models.CharField(max_length=100)
    encrypted_access_key = models.TextField(editable=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_theme_remote_connections",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_theme_remote_connections",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="unique_theme_remote_connection_name"),
            models.UniqueConstraint(
                fields=["tenant"],
                condition=Q(is_default=True),
                name="one_default_theme_remote_connection",
            ),
        ]
