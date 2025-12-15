"""
Core models for multi-tenancy support.

Tenant model provides account separation. Note that tenants do NOT define hostnames -
hostnames are managed separately via WebPage.hostnames array.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User


class Tenant(models.Model):
    """
    Tenant model for account separation.
    
    Tenants provide account/organization-level isolation. A tenant can have
    multiple hostnames (managed via WebPage.hostnames), but the tenant itself
    does not define hostnames.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for this tenant"
    )
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name for this tenant"
    )
    identifier = models.SlugField(
        unique=True,
        max_length=100,
        help_text="URL-safe identifier used for theme-sync directory structure (e.g., 'eceee_org')"
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Tenant-specific configuration (theme defaults, feature flags, etc.)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this tenant is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_tenants",
        help_text="User who created this tenant"
    )
    
    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["identifier"], name="tenant_identifier_idx"),
            models.Index(fields=["is_active"], name="tenant_is_active_idx"),
        ]
    
    def __str__(self):
        return self.name
