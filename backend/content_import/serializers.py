"""Serializers for Content Import API."""

from rest_framework import serializers
from content.models import Namespace


class CaptureScreenshotSerializer(serializers.Serializer):
    """Serializer for screenshot capture request."""

    url = serializers.URLField(required=True, max_length=2000)
    viewport_width = serializers.IntegerField(required=False, default=1920, min_value=320, max_value=3840)
    viewport_height = serializers.IntegerField(required=False, default=1080, min_value=240, max_value=2160)
    full_page = serializers.BooleanField(required=False, default=False)


class ExtractContentSerializer(serializers.Serializer):
    """Serializer for content extraction request."""

    url = serializers.URLField(required=True, max_length=2000)
    x = serializers.IntegerField(required=True, min_value=0)
    y = serializers.IntegerField(required=True, min_value=0)
    timeout = serializers.IntegerField(required=False, default=30000, min_value=5000, max_value=120000)


class ProcessImportSerializer(serializers.Serializer):
    """Serializer for import processing request."""

    html = serializers.CharField(required=True, allow_blank=False)
    slot_name = serializers.CharField(required=True, max_length=100)
    page_id = serializers.IntegerField(required=True)
    mode = serializers.ChoiceField(choices=["append", "replace"], default="append")
    namespace = serializers.CharField(required=True)
    source_url = serializers.URLField(required=False, allow_blank=True, max_length=2000)
    
    def validate_namespace(self, value):
        """Validate namespace exists and user has access."""
        try:
            if value == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=value)
            return namespace.slug
        except Namespace.DoesNotExist:
            raise serializers.ValidationError("Invalid namespace.")


class ImportLogSerializer(serializers.Serializer):
    """Serializer for import log response."""

    id = serializers.UUIDField()
    source_url = serializers.URLField()
    slot_name = serializers.CharField()
    page_id = serializers.IntegerField()
    status = serializers.CharField()
    widgets_created = serializers.IntegerField()
    media_files_imported = serializers.IntegerField()
    errors = serializers.ListField()
    stats = serializers.DictField()
    created_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)

