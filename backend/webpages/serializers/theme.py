# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Theme-related serializers for the Web Page Publishing System
"""

from rest_framework import serializers
from ..models import PageTheme, PreviewSize
from .base import UserSerializer


class PreviewSizeSerializer(serializers.ModelSerializer):
    """Serializer for preview size configurations"""

    class Meta:
        model = PreviewSize
        fields = [
            "id",
            "name",
            "width",
            "height",
            "sort_order",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_width(self, value):
        """Validate width is positive"""
        if value <= 0:
            raise serializers.ValidationError("Width must be greater than 0")
        return value

    def validate_height(self, value):
        """Validate height is positive if provided"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Height must be greater than 0")
        return value


# PageLayoutSerializer removed - now using code-based layouts only


class PageThemeSerializer(serializers.ModelSerializer):
    """Serializer for page themes with new 5-part structure"""

    created_by = UserSerializer(read_only=True)

    def to_representation(self, instance):
        """Custom representation to return full image URL and computed breakpoints"""
        data = super().to_representation(instance)

        # Convert image field to full URL
        if instance.image:
            # Get the URL from the ImageField
            image_url = instance.image.url

            # Check if it's an s3:// protocol URL (from LinodeObjectStorage)
            if image_url.startswith("s3://"):
                # Extract the file path from s3://bucket/path format
                try:
                    from django.core.files.storage import default_storage

                    # Remove s3://bucket/ prefix to get just the path
                    parts = image_url.replace("s3://", "").split("/", 1)
                    if len(parts) == 2:
                        file_path = parts[1]
                        # Use storage backend's get_public_url method if available
                        if hasattr(default_storage, "get_public_url"):
                            image_url = default_storage.get_public_url(file_path)
                        else:
                            # Fallback: use the image.name directly with storage
                            image_url = default_storage.url(instance.image.name)
                except Exception as e:
                    # If conversion fails, log and use the original URL
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.warning(f"Failed to convert s3:// URL to public URL: {e}")

            # Build absolute URI if request is available
            request = self.context.get("request")
            if request and not image_url.startswith(("http://", "https://")):
                data["image"] = request.build_absolute_uri(image_url)
            else:
                data["image"] = image_url
        else:
            data["image"] = None

        # Always include computed breakpoints (with defaults if not set)
        data["breakpoints"] = instance.get_breakpoints()

        return data

    class Meta:
        model = PageTheme
        fields = [
            "id",
            "name",
            "description",
            # New fields
            "fonts",
            "colors",
            "design_groups",
            "component_styles",
            "image_styles",
            "table_templates",
            "breakpoints",
            # Legacy fields (deprecated)
            "css_variables",
            "html_elements",
            "custom_css",
            "image",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate_breakpoints(self, value):
        """Validate breakpoints configuration"""
        if not value:
            return value

        if not isinstance(value, dict):
            raise serializers.ValidationError("Breakpoints must be a JSON object")

        # Validate that values are positive integers
        valid_keys = {"sm", "md", "lg", "xl"}
        for key, val in value.items():
            if key not in valid_keys:
                raise serializers.ValidationError(
                    f"Invalid breakpoint key '{key}'. Must be one of: {', '.join(valid_keys)}"
                )
            if not isinstance(val, int) or val <= 0:
                raise serializers.ValidationError(
                    f"Breakpoint '{key}' must be a positive integer (pixels)"
                )

        # Validate ascending order if multiple breakpoints provided
        if len(value) > 1:
            breakpoint_order = ["sm", "md", "lg", "xl"]
            provided_values = [(k, value[k]) for k in breakpoint_order if k in value]

            for i in range(len(provided_values) - 1):
                curr_name, curr_val = provided_values[i]
                next_name, next_val = provided_values[i + 1]
                if curr_val >= next_val:
                    raise serializers.ValidationError(
                        f"Breakpoints must be in ascending order: {curr_name} ({curr_val}px) "
                        f"must be less than {next_name} ({next_val}px)"
                    )

        return value

    def validate_fonts(self, value):
        """Validate fonts configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Fonts must be a JSON object")

        if "google_fonts" in value and not isinstance(value["google_fonts"], list):
            raise serializers.ValidationError("google_fonts must be a list")

        return value

    def validate_colors(self, value):
        """Validate colors configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Colors must be a JSON object")

        # Validate color values (hex, rgb, rgba, hsl, hsla, or CSS color names)
        import re

        hex_pattern = re.compile(r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
        rgb_pattern = re.compile(r"^rgba?\(")  # Matches both rgb() and rgba()
        hsl_pattern = re.compile(r"^hsla?\(")  # Matches both hsl() and hsla()

        for color_name, color_value in value.items():
            if not isinstance(color_value, str):
                raise serializers.ValidationError(
                    f"Color '{color_name}' must be a string"
                )

            # Allow hex, rgb, rgba, hsl, hsla formats
            if not (
                hex_pattern.match(color_value)
                or rgb_pattern.match(color_value)
                or hsl_pattern.match(color_value)
            ):
                # Allow CSS named colors
                if not color_value.isalpha():
                    raise serializers.ValidationError(
                        f"Color '{color_name}' has invalid format: {color_value}"
                    )

        return value

    def validate_typography(self, value):
        """Validate typography configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Typography must be a JSON object")

        if "groups" in value and not isinstance(value["groups"], list):
            raise serializers.ValidationError("Typography groups must be a list")

        return value

    def validate_component_styles(self, value):
        """Validate component styles configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Component styles must be a JSON object")

        # Validate each style has required fields
        for style_name, style_config in value.items():
            if not isinstance(style_config, dict):
                raise serializers.ValidationError(
                    f"Component style '{style_name}' must be an object"
                )

            if "template" not in style_config:
                raise serializers.ValidationError(
                    f"Component style '{style_name}' must have a 'template' field"
                )

        return value

    def validate_image_styles(self, value):
        """Validate image_styles configuration (unified gallery and carousel)"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Image styles must be a JSON object")

        # Auto-fix and validate each style
        for style_name, style_config in value.items():
            if not isinstance(style_config, dict):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' must be an object"
                )

            # Auto-fix: Add missing template with default value
            if "template" not in style_config:
                style_config["template"] = (
                    '<div class="image-gallery">\n'
                    '  {{#images}}\n'
                    '    <img src="{{url}}" alt="{{alt}}" loading="lazy">\n'
                    '  {{/images}}\n'
                    '</div>'
                )

            # Auto-fix: Add missing styleType with default value
            if "styleType" not in style_config:
                style_config["styleType"] = "gallery"

            if style_config["styleType"] not in ["gallery", "carousel"]:
                raise serializers.ValidationError(
                    f"Image style '{style_name}' has invalid styleType: {style_config['styleType']}. Must be 'gallery' or 'carousel'"
                )

            # Validate lightbox configuration
            if "enableLightbox" in style_config and not isinstance(
                style_config["enableLightbox"], bool
            ):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' enableLightbox must be a boolean"
                )

            if "lightboxTemplate" in style_config and not isinstance(
                style_config["lightboxTemplate"], str
            ):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' lightboxTemplate must be a string"
                )

            # Validate default values
            if "defaultShowCaptions" in style_config and not isinstance(
                style_config["defaultShowCaptions"], bool
            ):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' defaultShowCaptions must be a boolean"
                )

            if "defaultLightboxGroup" in style_config and not isinstance(
                style_config["defaultLightboxGroup"], str
            ):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' defaultLightboxGroup must be a string"
                )

            if "defaultRandomize" in style_config and not isinstance(
                style_config["defaultRandomize"], bool
            ):
                raise serializers.ValidationError(
                    f"Image style '{style_name}' defaultRandomize must be a boolean"
                )

            # Validate carousel-specific defaults only for carousel styles
            style_type = style_config["styleType"]
            if style_type == "carousel":
                if "defaultAutoPlay" in style_config and not isinstance(
                    style_config["defaultAutoPlay"], bool
                ):
                    raise serializers.ValidationError(
                        f"Carousel style '{style_name}' defaultAutoPlay must be a boolean"
                    )

                if "defaultAutoPlayInterval" in style_config:
                    interval = style_config["defaultAutoPlayInterval"]
                    if (
                        not isinstance(interval, (int, float))
                        or interval < 1
                        or interval > 30
                    ):
                        raise serializers.ValidationError(
                            f"Carousel style '{style_name}' defaultAutoPlayInterval must be a number between 1 and 30"
                        )
            else:
                # Gallery styles should not have carousel-specific defaults
                if "defaultAutoPlay" in style_config:
                    raise serializers.ValidationError(
                        f"Gallery style '{style_name}' should not have defaultAutoPlay (carousel only)"
                    )
                if "defaultAutoPlayInterval" in style_config:
                    raise serializers.ValidationError(
                        f"Gallery style '{style_name}' should not have defaultAutoPlayInterval (carousel only)"
                    )

        return value

    def validate_table_templates(self, value):
        """Validate table templates configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Table templates must be a JSON object")

        return value

    def validate_css_variables(self, value):
        """Validate that css_variables is a valid JSON object (deprecated)"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("CSS variables must be a JSON object")
        return value

    def validate_html_elements(self, value):
        """Validate that html_elements is a valid JSON object with proper structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("HTML elements must be a JSON object")

        # Validate each element's styles
        for element, styles in value.items():
            if not isinstance(element, str):
                raise serializers.ValidationError(
                    f"Element key must be a string, got {type(element)}"
                )

            if not isinstance(styles, dict):
                raise serializers.ValidationError(
                    f"Styles for element '{element}' must be a JSON object"
                )

            # Validate CSS property names and values
            for prop, val in styles.items():
                if not isinstance(prop, str):
                    raise serializers.ValidationError(
                        f"CSS property name must be a string for element '{element}'"
                    )
                if not isinstance(val, (str, int, float)):
                    raise serializers.ValidationError(
                        f"CSS property value must be a string or number for element '{element}', property '{prop}'"
                    )

        return value

