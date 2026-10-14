from urllib.parse import urlsplit

from rest_framework import serializers

from webpages.services.theme_remote_credentials import RemoteCredentialConfigurationError

from .credentials import decrypt_connection_secrets, encrypt_connection_secrets, split_sensitive_config
from .models import DataConnection, DataStream, DataTransformer


class DataTransformerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataTransformer
        fields = "__all__"


class DataStreamSerializer(serializers.ModelSerializer):
    workflow = serializers.JSONField(required=False, default=list, allow_null=True)

    class Meta:
        model = DataStream
        fields = "__all__"

    def validate_connection(self, value):
        request = self.context.get("request")
        if request and value.tenant_id != request.tenant.id:
            raise serializers.ValidationError("Select a connection from the current workspace.")
        return value


class DataConnectionSerializer(serializers.ModelSerializer):
    streams = DataStreamSerializer(many=True, read_only=True)
    secret_config = serializers.JSONField(write_only=True, required=False)
    has_secrets = serializers.SerializerMethodField()

    class Meta:
        model = DataConnection
        fields = [
            "id",
            "name",
            "description",
            "connection_type",
            "plugin_id",
            "config",
            "secret_config",
            "has_secrets",
            "is_active",
            "streams",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    @staticmethod
    def get_has_secrets(obj):
        return bool(obj.encrypted_secrets)

    def validate(self, attrs):
        embedded_secrets = {}
        if "config" in attrs:
            if not isinstance(attrs["config"], dict):
                raise serializers.ValidationError({"config": "Expected an object."})
            public_config, embedded_secrets = split_sensitive_config(attrs["config"])
            attrs["config"] = public_config
        explicit_secrets = attrs.pop("secret_config", {}) or {}
        if not isinstance(explicit_secrets, dict):
            raise serializers.ValidationError({"secretConfig": "Expected an object."})
        submitted_secrets = {**embedded_secrets, **explicit_secrets}
        connection_type = attrs.get("connection_type", getattr(self.instance, "connection_type", None))
        config = attrs.get("config", getattr(self.instance, "config", {})) or {}
        if not isinstance(config, dict):
            raise serializers.ValidationError({"config": "Expected an object."})
        if connection_type == "LEGACY_POSTGRES" and (
            self.instance is None or self.instance.connection_type != "LEGACY_POSTGRES"
        ):
            raise serializers.ValidationError(
                {
                    "connectionType": (
                        "Legacy PostgreSQL connections are no longer supported. "
                        "Create a Legacy Migration API connection."
                    )
                }
            )
        if connection_type == "LEGACY_API":
            base_url = str(config.get("baseUrl") or config.get("base_url") or "").strip()
            parsed = urlsplit(base_url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
            ):
                raise serializers.ValidationError(
                    {"config": {"baseUrl": "Enter a public HTTPS migration API base URL without embedded credentials."}}
                )
            existing_secrets = {}
            if self.instance and self.instance.encrypted_secrets:
                try:
                    existing_secrets = decrypt_connection_secrets(self.instance)
                except RemoteCredentialConfigurationError as exc:
                    raise serializers.ValidationError({"secretConfig": str(exc)}) from exc
            submitted_token = submitted_secrets.get("token")
            token = submitted_token if submitted_token not in (None, "") else existing_secrets.get("token")
            if not isinstance(token, str) or not token.strip():
                raise serializers.ValidationError({"secretConfig": {"token": "Enter the migration API access key."}})
        attrs["_submitted_secrets"] = submitted_secrets
        return attrs

    @staticmethod
    def _apply_secrets(instance, submitted):
        if not submitted:
            return
        existing = decrypt_connection_secrets(instance) if instance and instance.encrypted_secrets else {}
        merged = {**existing, **{key: value for key, value in submitted.items() if value not in (None, "")}}
        instance.encrypted_secrets = encrypt_connection_secrets(merged)

    def create(self, validated_data):
        submitted = validated_data.pop("_submitted_secrets", {})
        request = self.context["request"]
        instance = DataConnection(tenant=request.tenant, created_by=request.user, **validated_data)
        try:
            self._apply_secrets(instance, submitted)
        except RemoteCredentialConfigurationError as exc:
            raise serializers.ValidationError({"secretConfig": str(exc)}) from exc
        instance.save()
        return instance

    def update(self, instance, validated_data):
        submitted = validated_data.pop("_submitted_secrets", {})
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            self._apply_secrets(instance, submitted)
        except RemoteCredentialConfigurationError as exc:
            raise serializers.ValidationError({"secretConfig": str(exc)}) from exc
        instance.save()
        return instance


class DataConnectionListSerializer(serializers.ModelSerializer):
    stream_count = serializers.IntegerField(source="streams.count", read_only=True)
    has_secrets = serializers.SerializerMethodField()

    class Meta:
        model = DataConnection
        fields = [
            "id",
            "name",
            "connection_type",
            "plugin_id",
            "is_active",
            "has_secrets",
            "stream_count",
            "updated_at",
        ]

    @staticmethod
    def get_has_secrets(obj):
        return bool(obj.encrypted_secrets)
