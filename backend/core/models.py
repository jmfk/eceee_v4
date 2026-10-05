"""
Core models for multi-tenancy support.

Tenant model provides account separation. Note that tenants do NOT define hostnames -
hostnames are managed separately via WebPage.hostnames array.
"""

import uuid

from django.contrib.auth.models import User
from django.db import models


class MachineAPIKey(models.Model):
    """Hashed, revocable credential for a dedicated machine principal."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    principal = models.ForeignKey(User, on_delete=models.PROTECT, related_name="machine_api_keys")
    tenants = models.ManyToManyField("Tenant", related_name="machine_api_keys")
    environment = models.CharField(max_length=32)
    scopes = models.JSONField(default=list)
    key_hash = models.CharField(max_length=64, unique=True, editable=False)
    key_prefix = models.CharField(max_length=16, editable=False)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_machine_api_keys")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "created_at"]
        constraints = [models.UniqueConstraint(fields=["environment", "name"], name="unique_machine_key_name")]


class Tenant(models.Model):
    """
    Tenant model for account separation.

    Tenants provide account/organization-level isolation. A tenant can have
    multiple hostnames (managed via WebPage.hostnames), but the tenant itself
    does not define hostnames.
    """

    id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False, help_text="Unique identifier for this tenant"
    )
    name = models.CharField(max_length=255, help_text="Human-readable name for this tenant")
    identifier = models.SlugField(
        unique=True,
        max_length=100,
        help_text="URL-safe identifier used for theme-sync directory structure (e.g., 'eceee_org')",
    )
    settings = models.JSONField(
        default=dict, blank=True, help_text="Tenant-specific configuration (theme defaults, feature flags, etc.)"
    )
    is_active = models.BooleanField(default=True, help_text="Whether this tenant is active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_tenants", help_text="User who created this tenant"
    )
    members = models.ManyToManyField(
        User,
        blank=True,
        related_name="member_tenants",
        help_text="Users allowed to administer content in this tenant",
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["identifier"], name="tenant_identifier_idx"),
            models.Index(fields=["is_active"], name="tenant_is_active_idx"),
        ]

    def __str__(self):
        return self.name

    def user_has_access(self, user):
        """Return whether an authenticated user may administer this tenant."""
        if not user or not user.is_authenticated:
            return False
        from .permissions import user_can_switch_tenant

        if user_can_switch_tenant(user) or self.created_by_id == user.id:
            return True
        return self.members.filter(pk=user.pk).exists()
