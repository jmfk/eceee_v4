"""Serializers for site package export/import jobs."""

from rest_framework import serializers
from ..models import SitePackageJob, WebPage


class SitePackageJobSerializer(serializers.ModelSerializer):
    download_available = serializers.SerializerMethodField()
    download_filename = serializers.SerializerMethodField()
    root_page_id = serializers.SerializerMethodField()
    root_page_title = serializers.SerializerMethodField()
    imported_root_page_id = serializers.SerializerMethodField()

    class Meta:
        model = SitePackageJob
        fields = [
            "id",
            "kind",
            "status",
            "root_page_id",
            "root_page_title",
            "imported_root_page_id",
            "object_key",
            "progress",
            "errors",
            "options",
            "expires_at",
            "created_at",
            "updated_at",
            "download_available",
            "download_filename",
        ]
        read_only_fields = fields

    def get_download_available(self, obj):
        return bool(
            obj.kind == SitePackageJob.KIND_EXPORT
            and obj.status == SitePackageJob.STATUS_COMPLETED
            and obj.object_key
        )

    def get_download_filename(self, obj):
        if obj.kind != SitePackageJob.KIND_EXPORT or not obj.object_key:
            return None
        return obj.object_key.rsplit("/", 1)[-1]

    def get_root_page_id(self, obj):
        return obj.root_page_id

    def get_root_page_title(self, obj):
        return obj.root_page.title if obj.root_page_id and obj.root_page else None

    def get_imported_root_page_id(self, obj):
        return obj.imported_root_page_id


class SitePackageExportCreateSerializer(serializers.Serializer):
    root_page_id = serializers.IntegerField(required=False)
    rootPageId = serializers.IntegerField(
        source="root_page_id", required=False, write_only=True
    )
    include_media = serializers.BooleanField(default=True, required=False)
    includeMedia = serializers.BooleanField(
        source="include_media", required=False, write_only=True
    )
    include_themes = serializers.BooleanField(default=True, required=False)
    includeThemes = serializers.BooleanField(
        source="include_themes", required=False, write_only=True
    )

    def validate(self, attrs):
        if "root_page_id" not in attrs:
            raise serializers.ValidationError({"rootPageId": "This field is required."})
        return attrs

    def validate_root_page_id(self, value):
        request = self.context["request"]
        tenant = getattr(request, "tenant", None)
        queryset = WebPage.objects.filter(id=value, is_deleted=False, parent__isnull=True)
        if tenant:
            queryset = queryset.filter(tenant=tenant)
        if not queryset.exists():
            raise serializers.ValidationError("Root page not found")
        return value


class SitePackageImportCreateSerializer(serializers.Serializer):
    site_zip = serializers.FileField()
    preserve_publication_status = serializers.BooleanField(default=True)
