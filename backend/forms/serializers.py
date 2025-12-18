from rest_framework import serializers
from .models import Form, FormSubmission, FormFieldType

class FormFieldTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormFieldType
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

class FormSerializer(serializers.ModelSerializer):
    class Meta:
        model = Form
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "created_by")

class FormSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormSubmission
        fields = "__all__"
        read_only_fields = ("id", "created_at", "status", "processing_log")

