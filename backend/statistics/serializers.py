from rest_framework import serializers
from statistics.models import (
    EventRaw, PageStats, ConversionStats, 
    Experiment, Variant, Assignment, ExperimentMetric
)

class EventRawSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRaw
        fields = "__all__"

class PageStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageStats
        fields = "__all__"

class ConversionStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversionStats
        fields = "__all__"

class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ["id", "name", "allocation_percent", "metadata"]

class ExperimentSerializer(serializers.ModelSerializer):
    variants = VariantSerializer(many=True, required=False)

    class Meta:
        model = Experiment
        fields = [
            "id", "tenant_id", "name", "description", 
            "start_date", "end_date", "status", "goal_metric", "variants"
        ]

    def create(self, validated_data):
        variants_data = validated_data.pop("variants", [])
        experiment = Experiment.objects.create(**validated_data)
        for variant_data in variants_data:
            Variant.objects.create(experiment=experiment, **variant_data)
        return experiment

class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"

class ExperimentMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExperimentMetric
        fields = "__all__"

