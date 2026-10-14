from django.contrib.auth.models import User
from django.db import models

from core.models import Tenant
from object_storage.models import ObjectTypeDefinition


class DataConnection(models.Model):
    CONNECTION_TYPES = [
        ("INTERNAL", "Internal System"),
        ("EXTERNAL_REST", "External REST API"),
        ("EXTERNAL_DB", "External Database"),
        ("LEGACY_POSTGRES", "Legacy PostgreSQL (unsupported)"),
        ("LEGACY_API", "Legacy Migration API"),
        ("FILEMAKER", "FileMaker Data API"),
    ]

    tenant = models.ForeignKey(
        Tenant,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="data_connections",
        help_text="Owning tenant. Null legacy rows are quarantined from the tenant API.",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    connection_type = models.CharField(max_length=32, choices=CONNECTION_TYPES)
    plugin_id = models.CharField(max_length=160, blank=True)
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Non-secret connection configuration.",
    )
    encrypted_secrets = models.TextField(blank=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["tenant", "name"], name="unique_tenant_data_connection_name")]
        indexes = [models.Index(fields=["tenant", "connection_type"], name="data_conn_tenant_type_idx")]

    def __str__(self):
        return self.name


class DataTransformer(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    config = models.JSONField(
        default=dict, blank=True, help_text="Transformation mapping logic (mapping fields, aggregation rules)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class DataStream(models.Model):
    OUTPUT_TYPES = [
        ("JSON", "Simple JSON"),
        ("OBJECT_TYPE", "Matching ObjectType"),
    ]

    connection = models.ForeignKey(DataConnection, on_delete=models.CASCADE, related_name="streams")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    query_dsl = models.TextField(help_text="DSL or path for retrieving data")
    output_type = models.CharField(max_length=20, choices=OUTPUT_TYPES, default="JSON")
    object_type = models.ForeignKey(ObjectTypeDefinition, on_delete=models.SET_NULL, null=True, blank=True)
    transformer = models.ForeignKey(DataTransformer, on_delete=models.SET_NULL, null=True, blank=True)
    workflow = models.JSONField(
        default=list, blank=True, null=True, help_text="List of workflow actions to apply to each item"
    )
    cache_ttl = models.PositiveIntegerField(default=3600, help_text="Cache TTL in seconds")
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stream specific configuration (e.g., paging rules, headers)",
    )

    class Meta:
        unique_together = ("connection", "name")

    def __str__(self):
        return f"{self.connection.name} - {self.name}"
