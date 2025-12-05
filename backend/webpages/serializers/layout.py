# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Layout serializers for the Web Page Publishing System
"""

from rest_framework import serializers


# WidgetTypeSerializer removed - widget types are now code-based


class LayoutSerializer(serializers.Serializer):
    """
    Serializer for layout data including optional template data.

    Supports both code-based and template-based layouts with optional
    template data inclusion for enhanced API endpoints.
    """

    # Basic layout fields
    name = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True, allow_blank=True)
    template_name = serializers.CharField(read_only=True, allow_blank=True)
    css_classes = serializers.CharField(read_only=True, allow_blank=True)
    is_active = serializers.BooleanField(read_only=True)
    type = serializers.CharField(read_only=True)

    # Slot configuration
    slot_configuration = serializers.JSONField(read_only=True)

    # Template-based layout fields (optional)
    template_based = serializers.BooleanField(read_only=True, required=False)
    template_file = serializers.CharField(
        read_only=True, required=False, allow_blank=True
    )
    has_css = serializers.BooleanField(read_only=True, required=False)
    parsed_slots_count = serializers.IntegerField(read_only=True, required=False)
    parsing_errors = serializers.ListField(read_only=True, required=False)
    validation_config = serializers.JSONField(read_only=True, required=False)
    caching_enabled = serializers.BooleanField(read_only=True, required=False)

    # Enhanced template data fields (Phase 1.3)
    template_data = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        # Extract template data inclusion flag from context
        self.include_template_data = kwargs.pop("include_template_data", False)
        if "context" in kwargs and kwargs["context"]:
            self.include_template_data = kwargs["context"].get(
                "include_template_data", False
            )
        super().__init__(*args, **kwargs)

    def get_template_data(self, obj):
        """
        Get template data (HTML, CSS, parsed slots) when requested.

        Returns None if not requested or not available.
        """
        if not self.include_template_data:
            return None

        # For dict objects (from layout.to_dict())
        if isinstance(obj, dict):
            template_data = {}

            # Include HTML if available
            if "html" in obj and obj["html"]:
                template_data["html"] = obj["html"]

            # Include CSS if available
            if "css" in obj and obj["css"]:
                template_data["css"] = obj["css"]

            # Include parsed slots from slot_configuration
            if "slot_configuration" in obj:
                template_data["slots"] = obj["slot_configuration"]

            # Return None if no template data available
            return template_data if template_data else None

        # For layout objects
        if hasattr(obj, "_extracted_html") or hasattr(obj, "_extracted_css"):
            template_data = {}

            if hasattr(obj, "_extracted_html") and obj._extracted_html:
                template_data["html"] = obj._extracted_html

            if hasattr(obj, "_extracted_css") and obj._extracted_css:
                template_data["css"] = obj._extracted_css

            if hasattr(obj, "slot_configuration"):
                template_data["slots"] = obj.slot_configuration

            return template_data if template_data else None

        return None

