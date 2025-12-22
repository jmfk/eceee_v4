from django.db import models
from django.contrib.auth.models import User
from object_storage.models import ObjectTypeDefinition


class DataConnection(models.Model):
    CONNECTION_TYPES = [
        ("INTERNAL", "Internal System"),
        ("EXTERNAL_REST", "External REST API"),
        ("EXTERNAL_DB", "External Database"),
    ]

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    connection_type = models.CharField(max_length=20, choices=CONNECTION_TYPES)
    config = models.JSONField(
        default=dict,
        help_text="Connection configuration (e.g., base URL, credentials, DB params)",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.name


class DataTransformer(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    config = models.JSONField(
        help_text="Transformation mapping logic (mapping fields, aggregation rules)"
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

    connection = models.ForeignKey(
        DataConnection, on_delete=models.CASCADE, related_name="streams"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    query_dsl = models.TextField(help_text="DSL or path for retrieving data")
    output_type = models.CharField(max_length=20, choices=OUTPUT_TYPES, default="JSON")
    object_type = models.ForeignKey(
        ObjectTypeDefinition, on_delete=models.SET_NULL, null=True, blank=True
    )
    transformer = models.ForeignKey(
        DataTransformer, on_delete=models.SET_NULL, null=True, blank=True
    )
    workflow = models.JSONField(
        default=list, blank=True, null=True, help_text="List of workflow actions to apply to each item"
    )
    cache_ttl = models.PositiveIntegerField(
        default=3600, help_text="Cache TTL in seconds"
    )
    config = models.JSONField(
        default=dict,
        help_text="Stream specific configuration (e.g., paging rules, headers)",
    )

    class Meta:
        unique_together = ("connection", "name")

    def __str__(self):
        return f"{self.connection.name} - {self.name}"
