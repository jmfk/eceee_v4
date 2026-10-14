import uuid

from django.contrib.auth.models import User
from django.db import models

from core.models import Tenant


class TenantPluginActivation(models.Model):
    """Tenant opt-in for a trusted plugin installed with the application."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="plugin_activations")
    plugin_id = models.CharField(max_length=160)
    plugin_version = models.CharField(max_length=40)
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    activated_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="activated_tenant_plugins")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["plugin_id"]
        constraints = [models.UniqueConstraint(fields=["tenant", "plugin_id"], name="unique_tenant_plugin_activation")]
        indexes = [models.Index(fields=["tenant", "is_active"], name="tenant_plugin_active_idx")]
