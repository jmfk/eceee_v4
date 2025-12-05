# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Version-related serializers for the Web Page Publishing System
"""

from rest_framework import serializers
from ..models import PageVersion, PageTheme, WebPage, PageDataSchema
from .base import UserSerializer
from .theme import PageThemeSerializer


class PageVersionSerializer(serializers.ModelSerializer):
    """Serializer for page versions with enhanced workflow support"""

    created_by = UserSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()
    page_id = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    theme_inheritance_info = serializers.SerializerMethodField()

    # Writable page field for creation
    page = serializers.PrimaryKeyRelatedField(
        queryset=WebPage.objects.all(),
        write_only=True,
        required=False,
        help_text="Page ID for creating new version",
    )

    # Writable theme field
    theme = serializers.PrimaryKeyRelatedField(
        queryset=PageTheme.objects.all(),
        allow_null=True,
        required=False,
        help_text="Theme for this version (leave blank to inherit from parent)",
    )

    # Tags as array of strings
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
        default=list,
        help_text="List of tag names for this page version",
    )

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "version_id",
            "page",  # Writable field for creation
            "page_id",
            "version_number",
            "version_title",
            "meta_title",
            "meta_description",
            "code_layout",
            "page_data",
            "widgets",
            "tags",
            # Styling/config fields previously only in detail serializer
            "theme",
            "effective_theme",
            "theme_inheritance_info",
            "page_css_variables",
            "page_custom_css",
            "enable_css_injection",
            # New date-based publishing fields
            "effective_date",
            "expiry_date",
            "is_published",
            "is_current_published",
            "publication_status",
            # Metadata
            "change_summary",
            "created_at",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "version_id",
            "page_id",
            "version_number",
            "is_published",
            "is_current_published",
            "publication_status",
            "effective_theme",
            "theme_inheritance_info",
            "created_at",
            "created_by",
        ]

    def get_version_id(self, obj):
        return obj.id

    def get_page_id(self, obj):
        return obj.page.id

    def get_is_published(self, obj):
        """Check if this version is currently published based on dates"""
        return obj.is_published()

    def get_is_current_published(self, obj):
        """Check if this is the current published version for its page"""
        return obj.is_current_published()

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()

    def get_effective_theme(self, obj):
        """Get effective theme (explicit or inherited from parent)"""
        # First check if version has explicit theme
        if obj.theme:
            return PageThemeSerializer(obj.theme).data

        # Fall back to page's inheritance resolution
        theme = obj.page.get_effective_theme()
        return PageThemeSerializer(theme).data if theme else None

    def get_theme_inheritance_info(self, obj):
        """Get metadata about where theme comes from"""
        if obj.theme:
            return {"source": "explicit", "inherited_from": None}

        theme = obj.page.get_effective_theme()
        if not theme:
            return {"source": "none", "inherited_from": None}

        # Find which parent it came from
        current = obj.page.parent
        while current:
            current_version = current.get_current_published_version()
            if current_version and current_version.theme:
                return {
                    "source": "inherited",
                    "inherited_from": {
                        "page_id": current.id,
                        "page_title": current.title,
                        "theme_id": theme.id,
                        "theme_name": theme.name,
                    },
                }
            current = current.parent

        return {"source": "default", "inherited_from": None}

    def validate(self, attrs):
        # Strip forbidden keys from page_data on write
        return super().validate(attrs)

    def to_representation(self, instance):
        """Convert widget configuration fields from snake_case to camelCase for frontend"""
        data = super().to_representation(instance)

        # Convert widget configurations from snake_case to camelCase
        if "widgets" in data and isinstance(data["widgets"], dict):
            data["widgets"] = self._convert_widgets_to_camel_case(data["widgets"])

        # Debug logging for navbar menu items being sent to frontend
        import json

        if "widgets" in data and isinstance(data["widgets"], dict):
            for slot_name, widgets in data["widgets"].items():
                if isinstance(widgets, list):
                    for widget in widgets:
                        if (
                            isinstance(widget, dict)
                            and "config" in widget
                            and "menuItems" in widget["config"]
                        ):
                            for item in widget["config"]["menuItems"]:
                                if "url" in item:
                                    try:
                                        url_json = (
                                            json.loads(item["url"])
                                            if isinstance(item["url"], str)
                                            else item["url"]
                                        )
                                    except:
                                        pass

        return data

    def _convert_widgets_to_camel_case(self, widgets_data):
        """Convert widget configurations from snake_case to camelCase"""
        if not isinstance(widgets_data, dict):
            return widgets_data

        converted_widgets = {}

        for slot_name, widgets in widgets_data.items():
            if not isinstance(widgets, list):
                converted_widgets[slot_name] = widgets
                continue

            converted_widgets[slot_name] = []

            for widget in widgets:
                if not isinstance(widget, dict):
                    converted_widgets[slot_name].append(widget)
                    continue

                converted_widget = widget.copy()
                if "config" in widget:
                    converted_widget["config"] = self._convert_snake_to_camel(
                        widget["config"]
                    )

                converted_widgets[slot_name].append(converted_widget)

        return converted_widgets

    def _convert_snake_to_camel(self, obj):
        """Convert snake_case keys to camelCase recursively"""
        if isinstance(obj, dict):
            converted = {}
            for key, value in obj.items():
                # Convert snake_case key to camelCase
                camel_key = self._snake_to_camel_case(key)
                # Recursively convert nested objects
                converted[camel_key] = self._convert_snake_to_camel(value)
            return converted
        elif isinstance(obj, list):
            return [self._convert_snake_to_camel(item) for item in obj]
        else:
            return obj

    def _snake_to_camel_case(self, name):
        """Convert snake_case to camelCase"""
        components = name.split("_")
        return components[0] + "".join(word.capitalize() for word in components[1:])

    def update(self, instance, validated_data):
        """Update with timestamp-based conflict detection"""
        # Check if client provided the timestamp they last saw
        request = self.context.get("request")
        if request and hasattr(request, "data"):
            client_updated_at = request.data.get("client_updated_at")

            if client_updated_at:
                from django.utils.dateparse import parse_datetime
                from rest_framework.exceptions import ValidationError

                # Parse the client timestamp
                try:
                    client_timestamp = parse_datetime(client_updated_at)
                except (ValueError, TypeError):
                    raise ValidationError(
                        {"client_updated_at": "Invalid timestamp format"}
                    )

                # Compare with server's current updated_at
                # Refresh from DB to get latest timestamp
                instance.refresh_from_db()

                if instance.updated_at > client_timestamp:
                    # Conflict detected - server has newer data
                    # Serialize current server state for conflict resolution
                    server_serializer = PageVersionSerializer(instance)

                    raise ValidationError(
                        {
                            "error": "conflict",
                            "message": "This version has been modified by another user",
                            "server_version": server_serializer.data,
                            "server_updated_at": instance.updated_at.isoformat(),
                            "client_updated_at": client_updated_at,
                        }
                    )

        # No conflict - proceed with normal update
        updated_instance = super().update(instance, validated_data)

        # Broadcast version update to WebSocket clients
        try:
            from ..consumers import broadcast_version_update

            updated_by = None
            session_id = None

            if request:
                # Get username if authenticated
                if hasattr(request, "user") and request.user.is_authenticated:
                    updated_by = request.user.username

                # Get session ID from request header
                session_id = request.META.get("HTTP_X_SESSION_ID")

            broadcast_version_update(
                page_id=updated_instance.page.id,
                version_id=updated_instance.id,
                updated_at=updated_instance.updated_at.isoformat(),
                updated_by=updated_by,
                session_id=session_id,
            )
        except Exception as e:
            # Don't fail the update if broadcast fails
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to broadcast version update: {e}")

        return updated_instance


class WidgetUpdateSerializer(serializers.ModelSerializer):
    """Specialized serializer for widget-only updates"""

    class Meta:
        model = PageVersion
        fields = ["widgets"]

    def validate_widgets(self, value):
        """Basic widget data validation with camelCase to snake_case conversion"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Widgets must be a dictionary")

        # Convert camelCase to snake_case for widget configurations
        converted_widgets = {}

        for slot_name, widgets in value.items():
            if not isinstance(widgets, list):
                raise serializers.ValidationError(
                    f"Widgets in slot '{slot_name}' must be a list"
                )

            converted_widgets[slot_name] = []

            for i, widget in enumerate(widgets):
                if not isinstance(widget, dict):
                    raise serializers.ValidationError(
                        f"Widget {i} in slot '{slot_name}' must be a dictionary"
                    )

                # Basic required fields check - accept either 'type' or 'widget_type'
                if "type" not in widget and "widget_type" not in widget:
                    raise serializers.ValidationError(
                        f"Widget {i} in slot '{slot_name}' missing 'type' or 'widget_type' field"
                    )

                # Convert entire widget object from camelCase to snake_case
                # This includes metadata fields (inheritanceLevel, isPublished, etc.)
                # AND the config field
                converted_widget = self._convert_camel_to_snake(widget)

                converted_widgets[slot_name].append(converted_widget)

        # Debug logging for navbar menu items
        import json

        for slot_name, widgets in converted_widgets.items():
            for widget in widgets:
                if "config" in widget and "menu_items" in widget["config"]:
                    for item in widget["config"]["menu_items"]:
                        if "url" in item:
                            try:
                                url_json = (
                                    json.loads(item["url"])
                                    if isinstance(item["url"], str)
                                    else item["url"]
                                )
                            except:
                                pass
        return converted_widgets

    def _convert_camel_to_snake(self, obj):
        """Convert camelCase keys to snake_case recursively"""
        if isinstance(obj, dict):
            converted = {}
            for key, value in obj.items():
                # Convert camelCase key to snake_case
                snake_key = self._camel_to_snake_case(key)
                # Recursively convert nested objects
                converted[snake_key] = self._convert_camel_to_snake(value)
            return converted
        elif isinstance(obj, list):
            return [self._convert_camel_to_snake(item) for item in obj]
        else:
            return obj

    def _camel_to_snake_case(self, name):
        """Convert camelCase to snake_case"""
        import re

        # Insert underscore before uppercase letters (except first character)
        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        # Insert underscore before uppercase letters preceded by lowercase
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class PageDataUpdateSerializer(serializers.ModelSerializer):
    """Specialized serializer for page_data-only updates with schema validation"""

    class Meta:
        model = PageVersion
        fields = ["page_data"]

    def validate_page_data(self, value):
        """Validate page_data against effective schema"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Page data must be a dictionary")

        # Get the version instance to determine layout
        version = self.instance
        if not version:
            # For creation, we can't validate schema yet
            return value

        # Filter out forbidden keys
        forbidden = {
            "meta_title",
            "meta_description",
            "slug",
            "code_layout",
            "page_data",
            "widgets",
            "page_css_variables",
            "theme",
            "is_published",
            "version_title",
            "page_custom_css",
            "page_css_variables",
            "enable_css_injection",
        }

        filtered_data = {k: v for k, v in value.items() if k not in forbidden}

        # Validate against schema
        effective_schema = PageDataSchema.get_effective_schema_for_layout(
            version.code_layout
        )

        if effective_schema:
            from jsonschema import Draft202012Validator, Draft7Validator

            try:
                try:
                    Draft202012Validator.check_schema(effective_schema)
                    Draft202012Validator(effective_schema).validate(filtered_data)
                except Exception:
                    Draft7Validator.check_schema(effective_schema)
                    Draft7Validator(effective_schema).validate(filtered_data)
            except Exception as e:
                raise serializers.ValidationError(f"Schema validation failed: {str(e)}")

        return filtered_data


class MetadataUpdateSerializer(serializers.ModelSerializer):
    """Specialized serializer for version metadata updates"""

    class Meta:
        model = PageVersion
        fields = [
            "version_title",
            "code_layout",
            "theme",
            "meta_title",
            "meta_description",
            "page_css_variables",
            "page_custom_css",
            "enable_css_injection",
        ]


class PublishingUpdateSerializer(serializers.ModelSerializer):
    """Specialized serializer for publishing-related updates"""

    class Meta:
        model = PageVersion
        fields = ["effective_date", "expiry_date"]


class PageVersionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for version lists (without page_data)"""

    created_by = UserSerializer(read_only=True)

    # New date-based publishing fields (computed)
    is_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "version_number",
            "version_title",
            "meta_title",
            "meta_description",
            # New date-based publishing fields
            "effective_date",
            "expiry_date",
            "is_published",
            "publication_status",
            # Metadata
            "created_at",
            "created_by",
        ]

    def get_is_published(self, obj):
        """Check if this version is currently published based on dates"""
        return obj.is_published()

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()


class PageVersionComparisonSerializer(serializers.Serializer):
    """Serializer for version comparison results"""

    version1 = PageVersionListSerializer(read_only=True)
    version2 = PageVersionListSerializer(read_only=True)
    changes = serializers.JSONField(read_only=True)

    class Meta:
        fields = ["version1", "version2", "changes"]

