"""
Theme Sync Serializer

Serializer for theme synchronization with version conflict detection.
"""

from rest_framework import serializers
from ..models import PageTheme
from .theme import PageThemeSerializer


class ThemeSyncSerializer(PageThemeSerializer):
    """Serializer for theme sync operations with version tracking"""

    sync_version = serializers.IntegerField(read_only=True)
    last_synced_at = serializers.DateTimeField(read_only=True)
    sync_source = serializers.CharField(read_only=True)

    class Meta(PageThemeSerializer.Meta):
        fields = PageThemeSerializer.Meta.fields + [
            "sync_version",
            "last_synced_at",
            "sync_source",
        ]
        read_only_fields = PageThemeSerializer.Meta.read_only_fields + [
            "sync_version",
            "last_synced_at",
            "sync_source",
        ]

    def validate(self, attrs):
        """Validate version conflict on update"""
        if self.instance:
            # Check if client version matches server version
            client_version = self.initial_data.get("sync_version")
            if client_version is not None:
                server_version = self.instance.sync_version
                if client_version < server_version:
                    raise serializers.ValidationError(
                        {
                            "sync_version": (
                                f"Version conflict: Client version ({client_version}) "
                                f"is older than server version ({server_version}). "
                                "Please pull latest changes and resolve conflicts."
                            )
                        }
                    )
        return attrs


class ThemeSyncPushSerializer(serializers.Serializer):
    """Serializer for push operations - includes version check"""

    sync_version = serializers.IntegerField(help_text="Current client version")
    theme_data = ThemeSyncSerializer(help_text="Theme data to push")

    def validate(self, attrs):
        """Validate version before push"""
        theme_data = attrs.get("theme_data")
        client_version = attrs.get("sync_version")

        if not theme_data:
            raise serializers.ValidationError("theme_data is required")

        # If updating existing theme, check version
        theme_name = theme_data.get("name")
        if theme_name:
            try:
                theme = PageTheme.objects.get(name=theme_name)
                if client_version < theme.sync_version:
                    raise serializers.ValidationError(
                        {
                            "sync_version": (
                                f"Version conflict: Client version ({client_version}) "
                                f"is older than server version ({theme.sync_version}). "
                                "Please pull latest changes first."
                            )
                        }
                    )
            except PageTheme.DoesNotExist:
                pass  # New theme, no version check needed

        return attrs


class ThemeSyncStatusSerializer(serializers.Serializer):
    """Serializer for sync status response"""

    themes = ThemeSyncSerializer(many=True)
    max_version = serializers.IntegerField(help_text="Highest sync_version in database")


class ThemeSyncConflictCheckSerializer(serializers.Serializer):
    """Serializer for conflict check response"""

    has_conflict = serializers.BooleanField()
    client_version = serializers.IntegerField()
    server_version = serializers.IntegerField()
    theme_name = serializers.CharField()

