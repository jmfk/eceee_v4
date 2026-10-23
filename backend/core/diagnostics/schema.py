"""OpenAPI authentication and diagnostic response contracts."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import serializers


class MachineKeySchema(OpenApiAuthenticationExtension):
    target_class = "core.machine_api_keys.MachineAPIKeyAuthentication"
    name = "machineApiKey"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": (
                "ApiKey <secret>. Diagnostics requires explicit diagnostics.* scopes; "
                "CMS server.full_access is insufficient."
            ),
        }


class FrameSerializer(serializers.Serializer):
    file = serializers.CharField()
    line = serializers.IntegerField()
    function = serializers.CharField()


class EventSerializer(serializers.Serializer):
    id = serializers.CharField()
    time = serializers.DateTimeField()
    service = serializers.CharField()
    level = serializers.CharField()
    error_class = serializers.CharField()
    message = serializers.CharField()
    tenant_id = serializers.UUIDField(allow_null=True)
    request_id = serializers.UUIDField(allow_null=True)
    group_id = serializers.CharField()
    frames = FrameSerializer(many=True)


class LogResultsSerializer(serializers.Serializer):
    results = EventSerializer(many=True)
    groups = serializers.ListField(child=serializers.DictField())
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    generation = serializers.CharField()
    incomplete = serializers.BooleanField()
    limited = serializers.BooleanField()
    bytes_scanned = serializers.IntegerField(required=False)
    next_cursor = serializers.CharField(allow_null=True)


class SourcesSerializer(serializers.Serializer):
    sources = serializers.ListField(child=serializers.DictField())
    health = serializers.DictField(required=False)
    gaps = serializers.ListField(child=serializers.DictField(), required=False)
    created_at = serializers.DateTimeField(required=False)
    oldest_export_at = serializers.DateTimeField(required=False, allow_null=True)
    stale = serializers.BooleanField(required=False)
    retention_limited = serializers.BooleanField(required=False)
    incomplete = serializers.BooleanField(required=False)


class CatalogSerializer(serializers.Serializer):
    results = serializers.ListField(child=serializers.DictField())


class DataResultsSerializer(serializers.Serializer):
    results = serializers.ListField(child=serializers.DictField())
    next_cursor = serializers.CharField(allow_null=True)
    consistency = serializers.ChoiceField(choices=["live_rows"])
    limited = serializers.BooleanField()
