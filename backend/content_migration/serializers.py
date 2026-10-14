from rest_framework import serializers
from .models import MigrationPlan, MigrationJob, MigrationTask, PluginImportJob
from data_connections.serializers import DataConnectionSerializer
from object_storage.serializers import ObjectTypeDefinitionSerializer


class MigrationPlanSerializer(serializers.ModelSerializer):
    source_connection_details = DataConnectionSerializer(source="source_connection", read_only=True)
    target_object_type_details = ObjectTypeDefinitionSerializer(source="target_object_type", read_only=True)

    class Meta:
        model = MigrationPlan
        fields = "__all__"
        read_only_fields = ["tenant", "created_by"]

    def validate_source_connection(self, value):
        request = self.context.get("request")
        if request and value.tenant_id != request.tenant.id:
            raise serializers.ValidationError("Select a connection from the current workspace.")
        return value

    def validate_target_object_type(self, value):
        request = self.context.get("request")
        if request and (not value.namespace_id or value.namespace.tenant_id != request.tenant.id):
            raise serializers.ValidationError("Select an object type from the current workspace.")
        return value


class MigrationJobSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source="plan.name")

    class Meta:
        model = MigrationJob
        fields = "__all__"


class MigrationTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MigrationTask
        fields = "__all__"


class PluginImportJobSerializer(serializers.ModelSerializer):
    connection_name = serializers.ReadOnlyField(source="connection.name")

    class Meta:
        model = PluginImportJob
        fields = [
            "id",
            "importer_id",
            "importer_version",
            "connection",
            "connection_name",
            "idempotency_key",
            "status",
            "phase",
            "options",
            "progress",
            "result",
            "errors",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
