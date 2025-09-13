"""
Django REST Framework serializers for the Web Page Publishing System

Provides serialization and deserialization for all web page models,
including hierarchical relationships and inheritance logic.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    WebPage,
    PageVersion,
    PageTheme,
    PageDataSchema,
)
from django.utils import timezone
from content.models import Tag
from content.serializers import TagSerializer


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer for references"""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]
        read_only_fields = ["id"]


# PageLayoutSerializer removed - now using code-based layouts only


class PageThemeSerializer(serializers.ModelSerializer):
    """Serializer for page themes"""

    created_by = UserSerializer(read_only=True)

    class Meta:
        model = PageTheme
        fields = [
            "id",
            "name",
            "description",
            "css_variables",
            "html_elements",
            "image_styles",
            "custom_css",
            "image",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate_css_variables(self, value):
        """Validate that css_variables is a valid JSON object"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("CSS variables must be a JSON object")
        return value

    def validate_image_styles(self, value):
        """Validate that image_styles is a valid JSON object with proper structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Image styles must be a JSON object")

        # Validate each style's configuration
        for style_name, style_config in value.items():
            if not isinstance(style_name, str):
                raise serializers.ValidationError(
                    f"Style name must be a string, got {type(style_name)}"
                )

            if not isinstance(style_config, dict):
                raise serializers.ValidationError(
                    f"Configuration for style '{style_name}' must be a JSON object"
                )

            # Validate style configuration properties
            valid_alignments = ["left", "center", "right"]
            valid_spacings = ["tight", "normal", "loose"]
            valid_border_radius = ["none", "normal", "large", "full"]
            valid_shadows = ["none", "sm", "lg"]

            if (
                "alignment" in style_config
                and style_config["alignment"] not in valid_alignments
            ):
                raise serializers.ValidationError(
                    f"Invalid alignment '{style_config['alignment']}' in style '{style_name}'"
                )

            if "galleryColumns" in style_config:
                columns = style_config["galleryColumns"]
                if not isinstance(columns, int) or not (1 <= columns <= 6):
                    raise serializers.ValidationError(
                        f"Gallery columns must be an integer between 1 and 6 in style '{style_name}'"
                    )

            if (
                "spacing" in style_config
                and style_config["spacing"] not in valid_spacings
            ):
                raise serializers.ValidationError(
                    f"Invalid spacing '{style_config['spacing']}' in style '{style_name}'"
                )

            if (
                "borderRadius" in style_config
                and style_config["borderRadius"] not in valid_border_radius
            ):
                raise serializers.ValidationError(
                    f"Invalid border radius '{style_config['borderRadius']}' in style '{style_name}'"
                )

            if "shadow" in style_config and style_config["shadow"] not in valid_shadows:
                raise serializers.ValidationError(
                    f"Invalid shadow '{style_config['shadow']}' in style '{style_name}'"
                )

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


class WebPageTreeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for page tree views"""

    title = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    # description = serializers.SerializerMethodField()
    code_layout = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "slug",
            "title",
            "description",
            "code_layout",
            "parent",
            "sort_order",
            "hostnames",
            "publication_status",
            "effective_date",
            "expiry_date",
            "children_count",
        ]

    def get_title(self, obj):
        """Get title from WebPage model - for version title use PageVersionSerializer"""
        return obj.title

    def get_code_layout(self, obj):
        """DEPRECATED: Get code layout from PageVersionSerializer instead"""
        return ""

    def get_children_count(self, obj):
        return obj.children.count()

    def get_publication_status(self, obj):
        """DEPRECATED: Get publication status from PageVersionSerializer instead"""
        return "unknown"

    def get_effective_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None

    def get_expiry_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None


class WebPageSimpleSerializer(serializers.ModelSerializer):
    """Simplified page serializer - only page metadata, no version data"""

    parent = WebPageTreeSerializer(read_only=True)
    parent_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)

    # Computed fields (page-level only)
    absolute_url = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    effective_layout = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    layout_inheritance_info = serializers.SerializerMethodField()
    available_code_layouts = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "slug",
            "title",
            "description",
            "parent",
            "parent_id",
            "sort_order",
            "hostnames",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "absolute_url",
            "breadcrumbs",
            "effective_layout",
            "effective_theme",
            "layout_inheritance_info",
            "available_code_layouts",
            "children_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
        ]

    def __init__(self, *args, **kwargs):
        """Allow callers to include version info on demand.

        If `include_version_info=True` is passed either as a kwarg or via
        serializer context, two additional computed fields will be exposed:
        - is_published
        - current_published_version
        """
        include_version_info = kwargs.pop("include_version_info", None)
        super().__init__(*args, **kwargs)

        if include_version_info is None:
            include_version_info = self.context.get("include_version_info", False)

        if include_version_info:
            # Add fields dynamically so the Meta.fields list remains unchanged
            self.fields["is_published"] = serializers.SerializerMethodField()
            self.fields["current_published_version"] = (
                serializers.SerializerMethodField()
            )

    def get_absolute_url(self, obj):
        return obj.get_absolute_url()

    def get_is_published(self, obj):
        return obj.is_published()

    def get_breadcrumbs(self, obj):
        breadcrumbs = obj.get_breadcrumbs()
        return [
            {"id": page.id, "title": page.title, "slug": page.slug}
            for page in breadcrumbs
        ]

    def get_effective_layout(self, obj):
        """Get the effective layout as a unified dictionary regardless of type"""
        return obj.get_effective_layout_dict()

    def get_effective_theme(self, obj):
        theme = obj.get_effective_theme()
        return PageThemeSerializer(theme).data if theme else None

    def get_layout_type(self, obj):
        """Get the type of layout: 'code', 'database', 'inherited', or None"""
        return obj.get_layout_type()

    def get_layout_inheritance_info(self, obj):
        """Get detailed layout inheritance information"""
        inheritance_info = obj.get_layout_inheritance_info()

        # Serialize the inheritance chain for API consumption
        serialized_chain = []
        for chain_item in inheritance_info["inheritance_chain"]:
            page = chain_item["page"]
            serialized_chain.append(
                {
                    "page_id": page.id,
                    "page_title": page.title,
                    "code_layout": chain_item["code_layout"],
                    "is_override": chain_item["is_override"],
                }
            )

        serialized_inheritance_info = {
            "effective_layout": (
                inheritance_info["effective_layout"].to_dict()
                if inheritance_info["effective_layout"]
                else None
            ),
            "effective_layout_dict": inheritance_info["effective_layout_dict"],
            "inherited_from": (
                {
                    "id": inheritance_info["inherited_from"].id,
                    "title": obj.title,
                }
                if inheritance_info["inherited_from"]
                else None
            ),
            "inheritance_chain": serialized_chain,
            "override_options": {
                "code_layouts": [
                    layout.to_dict()
                    for layout in inheritance_info["override_options"]["code_layouts"]
                ]
            },
        }

        return serialized_inheritance_info

    def get_available_code_layouts(self, obj):
        """Get list of available code layouts"""
        from .layout_registry import layout_registry

        return [
            layout.to_dict()
            for layout in layout_registry.list_layouts(active_only=True)
        ]

    def get_children_count(self, obj):
        return obj.children.count()


class PageVersionSerializer(serializers.ModelSerializer):
    """Serializer for page versions with enhanced workflow support"""

    created_by = UserSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()

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
            "version_number",
            "is_published",
            "is_current_published",
            "publication_status",
            "created_at",
            "created_by",
        ]

    def get_is_published(self, obj):
        """Check if this version is currently published based on dates"""
        return obj.is_published()

    def get_is_current_published(self, obj):
        """Check if this is the current published version for its page"""
        return obj.is_current_published()

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()

    def validate(self, attrs):
        # Strip forbidden keys from page_data on write
        return super().validate(attrs)

    def to_representation(self, instance):
        """Convert widget configuration fields from snake_case to camelCase for frontend"""
        data = super().to_representation(instance)

        # Convert widget configurations from snake_case to camelCase
        if "widgets" in data and isinstance(data["widgets"], dict):
            data["widgets"] = self._convert_widgets_to_camel_case(data["widgets"])

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


class PageDataSchemaSerializer(serializers.ModelSerializer):
    """Serializer for page data JSON Schemas (system and layout scopes)."""

    created_by = UserSerializer(read_only=True)
    layout_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, allow_null=True
    )

    def to_internal_value(self, data):
        # Ensure layout_name is present for field validation
        if "layout_name" not in data:
            data = data.copy() if hasattr(data, "copy") else dict(data)
            data["layout_name"] = ""

        # Schema field is kept in camelCase - no conversion needed
        return super().to_internal_value(data)

    def to_representation(self, instance):
        """Schema field is already in camelCase - no conversion needed"""
        data = super().to_representation(instance)
        return data

    class Meta:
        model = PageDataSchema
        fields = [
            "id",
            "name",
            "description",
            "scope",
            "layout_name",
            "schema",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate(self, data):
        # Handle system vs layout scope constraints
        scope = data.get("scope", getattr(self.instance, "scope", None))

        if scope == PageDataSchema.SCOPE_SYSTEM:
            # For system schemas, clear layout_name and name fields (like model.clean())
            data["layout_name"] = ""
            data["name"] = ""
        elif scope == PageDataSchema.SCOPE_LAYOUT:
            # For layout schemas, layout_name is required
            layout_name = data.get(
                "layout_name", getattr(self.instance, "layout_name", "")
            )
            if not layout_name:
                raise serializers.ValidationError(
                    {"layout_name": "Layout name is required for layout scope"}
                )
        else:
            # Default layout_name to empty string if not provided
            if "layout_name" not in data:
                data["layout_name"] = ""

        # Validate JSON Schema correctness using jsonschema library
        try:
            from jsonschema import Draft202012Validator, Draft7Validator

            schema = data.get("schema", getattr(self.instance, "schema", {}))
            # Try latest first, fall back to draft-07
            try:
                Draft202012Validator.check_schema(schema)
            except Exception:
                Draft7Validator.check_schema(schema)
        except Exception as e:
            raise serializers.ValidationError(
                {"schema": f"Invalid JSON Schema: {str(e)}"}
            )

        return data


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

                # Convert widget configuration from camelCase to snake_case
                converted_widget = widget.copy()
                if "config" in widget:
                    converted_widget["config"] = self._convert_camel_to_snake(
                        widget["config"]
                    )

                converted_widgets[slot_name].append(converted_widget)

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
        from ..models import PageDataSchema

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


class PageHierarchySerializer(serializers.ModelSerializer):
    """Recursive serializer for complete page hierarchy"""

    title = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "sort_order",
            "hostnames",
            "publication_status",
            "effective_date",
            "expiry_date",
            "children",
        ]

    def get_title(self, obj):
        """Get title from WebPage model - for version title use PageVersionSerializer"""
        return obj.title or obj.slug or f"Page {obj.id}"

    def get_children(self, obj):
        # Filter children that are published based on their versions
        published_children = []
        for child in obj.children.order_by("sort_order"):
            if child.is_published():
                published_children.append(child)
        return PageHierarchySerializer(
            published_children, many=True, context=self.context
        ).data

    def get_publication_status(self, obj):
        """DEPRECATED: Get publication status from PageVersionSerializer instead"""
        return "unknown"

    def get_effective_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None

    def get_expiry_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None

    def get_current_published_version(self, obj):
        """DEPRECATED: Get version info via PageVersionViewSet instead"""
        return None
