"""Serializers for site package export/import jobs."""

from rest_framework import serializers

from ..models import RemoteSiteBinding, SitePackageJob, ThemeRemoteConnection, WebPage


class SitePackageJobSerializer(serializers.ModelSerializer):
    download_available = serializers.SerializerMethodField()
    download_filename = serializers.SerializerMethodField()
    root_page_id = serializers.SerializerMethodField()
    root_page_title = serializers.SerializerMethodField()
    imported_root_page_id = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    mode = serializers.SerializerMethodField()
    connection_id = serializers.SerializerMethodField()
    remote_site_key = serializers.SerializerMethodField()
    phase = serializers.SerializerMethodField()
    warnings = serializers.SerializerMethodField()

    class Meta:
        model = SitePackageJob
        fields = [
            "id",
            "kind",
            "status",
            "root_page_id",
            "root_page_title",
            "imported_root_page_id",
            "source",
            "mode",
            "connection_id",
            "remote_site_key",
            "phase",
            "warnings",
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
            obj.kind == SitePackageJob.KIND_EXPORT and obj.status == SitePackageJob.STATUS_COMPLETED and obj.object_key
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

    def get_source(self, obj):
        return (obj.options or {}).get("source", "zip")

    def get_mode(self, obj):
        return (obj.options or {}).get("mode", "copy")

    def get_connection_id(self, obj):
        return (obj.options or {}).get("connection_id")

    def get_remote_site_key(self, obj):
        return (obj.options or {}).get("remote_site_key")

    def get_phase(self, obj):
        return (obj.progress or {}).get("phase")

    def get_warnings(self, obj):
        return (obj.progress or {}).get("warnings", [])


class SitePackageExportCreateSerializer(serializers.Serializer):
    root_page_id = serializers.IntegerField(required=False)
    rootPageId = serializers.IntegerField(source="root_page_id", required=False, write_only=True)
    include_media = serializers.BooleanField(default=True, required=False)
    includeMedia = serializers.BooleanField(source="include_media", required=False, write_only=True)
    include_themes = serializers.BooleanField(default=True, required=False)
    includeThemes = serializers.BooleanField(source="include_themes", required=False, write_only=True)

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
    preserve_publication_status = serializers.BooleanField(required=False, write_only=True)
    preservePublicationStatus = serializers.BooleanField(required=False, write_only=True)
    mode = serializers.ChoiceField(choices=("prompt", "clone", "update"), default="prompt")
    existingRootId = serializers.IntegerField(
        source="existing_root_id", required=False, allow_null=True, write_only=True
    )

    def validate(self, attrs):
        has_snake_value = "preserve_publication_status" in self.initial_data
        has_camel_value = "preservePublicationStatus" in self.initial_data
        snake_value = (
            attrs.get("preserve_publication_status", serializers.empty) if has_snake_value else serializers.empty
        )
        camel_value = (
            attrs.pop("preservePublicationStatus", serializers.empty) if has_camel_value else serializers.empty
        )
        attrs.pop("preservePublicationStatus", None)
        if snake_value is not serializers.empty and camel_value is not serializers.empty and snake_value != camel_value:
            raise serializers.ValidationError(
                {"preservePublicationStatus": "Conflicting publication-status values were provided."}
            )
        attrs["preserve_publication_status"] = (
            camel_value
            if camel_value is not serializers.empty
            else snake_value if snake_value is not serializers.empty else True
        )
        if attrs["mode"] == "update" and not attrs.get("existing_root_id"):
            raise serializers.ValidationError({"existingRootId": "Choose the existing site to update."})
        return attrs


class RemoteSiteListSerializer(serializers.Serializer):
    connection_id = serializers.UUIDField(required=False)
    connectionId = serializers.UUIDField(source="connection_id", required=False, write_only=True)

    def validate(self, attrs):
        if "connection_id" not in attrs:
            raise serializers.ValidationError({"connectionId": "This field is required."})
        request = self.context["request"]
        connection = ThemeRemoteConnection.objects.filter(
            id=attrs["connection_id"], tenant=request.tenant, is_active=True
        ).first()
        if connection is None:
            raise serializers.ValidationError({"connectionId": "Remote connection not found."})
        attrs["connection"] = connection
        return attrs


class RemoteSiteImportCreateSerializer(RemoteSiteListSerializer):
    remote_site_key = serializers.UUIDField(required=False)
    remoteSiteKey = serializers.UUIDField(source="remote_site_key", required=False, write_only=True)
    mode = serializers.ChoiceField(choices=("copy", "update"), default="copy")
    local_root_id = serializers.IntegerField(required=False, allow_null=True)
    localRootId = serializers.IntegerField(source="local_root_id", required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "remote_site_key" not in attrs:
            raise serializers.ValidationError({"remoteSiteKey": "This field is required."})
        if attrs["mode"] == "update":
            local_root_id = attrs.get("local_root_id")
            if not local_root_id:
                raise serializers.ValidationError({"localRootId": "Choose a linked local site."})
            if not RemoteSiteBinding.objects.filter(
                tenant=self.context["request"].tenant,
                connection=attrs["connection"],
                remote_root_key=attrs["remote_site_key"],
                local_root_id=local_root_id,
                local_root__is_deleted=False,
                local_root__parent__isnull=True,
            ).exists():
                raise serializers.ValidationError({"localRootId": "This site is not linked to the remote site."})
        return attrs
