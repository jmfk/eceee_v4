from rest_framework import serializers
from .models import MigrationPlan, MigrationJob, MigrationTask
from data_connections.serializers import DataConnectionSerializer
from object_storage.serializers import ObjectTypeDefinitionSerializer


class MigrationPlanSerializer(serializers.ModelSerializer):
    source_connection_details = DataConnectionSerializer(
        source="source_connection", read_only=True
    )
    target_object_type_details = ObjectTypeDefinitionSerializer(
        source="target_object_type", read_only=True
    )

    class Meta:
        model = MigrationPlan
        fields = "__all__"


class MigrationJobSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source="plan.name")

    class Meta:
        model = MigrationJob
        fields = "__all__"


class MigrationTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MigrationTask
        fields = "__all__"
