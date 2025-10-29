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
    PreviewSize,
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
        """Custom representation to return full image URL"""
        data = super().to_representation(instance)

        # Convert image field to full URL
        if instance.image:
            request = self.context.get("request")
            if request:
                data["image"] = request.build_absolute_uri(instance.image.url)
            else:
                data["image"] = instance.image.url
        else:
            data["image"] = None

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
            "typography",
            "component_styles",
            "gallery_styles",
            "carousel_styles",
            "table_templates",
            # Legacy fields (deprecated)
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
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "image"]

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

    def validate_image_styles(self, value):
        """Validate that image_styles is a valid JSON object with proper structure (deprecated)"""
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


class WebPageSimpleSerializer(serializers.ModelSerializer):
    """Page serializer with version management support"""

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
    is_deleted = serializers.SerializerMethodField()
    deleted_at = serializers.SerializerMethodField()
    deleted_by = serializers.SerializerMethodField()

    # Version management fields
    publication_status = serializers.SerializerMethodField()
    code_layout = serializers.SerializerMethodField()

    # Published version information
    published_version_id = serializers.SerializerMethodField()
    published_version_number = serializers.SerializerMethodField()
    published_effective_date = serializers.SerializerMethodField()

    # Latest draft version information
    latest_version_number = serializers.SerializerMethodField()
    latest_draft_version_id = serializers.SerializerMethodField()
    latest_draft_version_number = serializers.SerializerMethodField()
    has_unpublished_changes = serializers.SerializerMethodField()

    # Scheduled version information
    scheduled_version_id = serializers.SerializerMethodField()
    scheduled_version_number = serializers.SerializerMethodField()
    scheduled_effective_date = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "slug",
            "title",
            "description",
            "parent_id",
            "sort_order",
            "hostnames",
            "site_icon",
            "path_pattern_key",
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
            "is_deleted",
            "deleted_at",
            "deleted_by",
            # Version management fields
            "publication_status",
            "code_layout",
            # Published version
            "published_version_id",
            "published_version_number",
            "published_effective_date",
            # Latest/draft version
            "latest_version_number",
            "latest_draft_version_id",
            "latest_draft_version_number",
            "has_unpublished_changes",
            # Scheduled version
            "scheduled_version_id",
            "scheduled_version_number",
            "scheduled_effective_date",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "is_deleted",
            "deleted_at",
            "deleted_by",
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

    def get_is_deleted(self, obj):
        """Get is_deleted field (safe if migration not run)"""
        return getattr(obj, "is_deleted", False)

    def get_deleted_at(self, obj):
        """Get deleted_at field (safe if migration not run)"""
        return getattr(obj, "deleted_at", None)

    def get_deleted_by(self, obj):
        """Get deleted_by field (safe if migration not run)"""
        deleted_by = getattr(obj, "deleted_by", None)
        if deleted_by:
            return UserSerializer(deleted_by).data
        return None

    # Version management methods
    def get_code_layout(self, obj):
        """Get code layout from published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].code_layout or ""
        published_version = obj.get_current_published_version()
        if published_version:
            return published_version.code_layout or ""
        return ""

    def get_publication_status(self, obj):
        """Get publication status from current published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].get_publication_status()

        published_version = obj.get_current_published_version()
        if published_version:
            return published_version.get_publication_status()

        # No published version - check for drafts
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            return obj._all_versions_list[0].get_publication_status()

        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        return "unpublished"

    # Published version methods
    def get_published_version_id(self, obj):
        """Get the ID of currently published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].id
        published_version = obj.get_current_published_version()
        return published_version.id if published_version else None

    def get_published_version_number(self, obj):
        """Get the version number of currently published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].version_number
        published_version = obj.get_current_published_version()
        return published_version.version_number if published_version else None

    def get_published_effective_date(self, obj):
        """Get the effective date of published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].effective_date
        published_version = obj.get_current_published_version()
        return published_version.effective_date if published_version else None

    # Latest/draft version methods
    def get_latest_version_number(self, obj):
        """Get the latest version number (including drafts)"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            return obj._all_versions_list[0].version_number
        latest_version = obj.get_latest_version()
        return latest_version.version_number if latest_version else None

    def get_latest_draft_version_id(self, obj):
        """Get the ID of latest draft (unpublished) version"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest = obj._all_versions_list[0]
            if latest.get_publication_status() in ["draft", "unpublished"]:
                return latest.id
        else:
            latest_version = obj.get_latest_version()
            if latest_version and latest_version.get_publication_status() in [
                "draft",
                "unpublished",
            ]:
                return latest_version.id
        return None

    def get_latest_draft_version_number(self, obj):
        """Get the version number of latest draft"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest = obj._all_versions_list[0]
            if latest.get_publication_status() in ["draft", "unpublished"]:
                return latest.version_number
        else:
            latest_version = obj.get_latest_version()
            if latest_version and latest_version.get_publication_status() in [
                "draft",
                "unpublished",
            ]:
                return latest_version.version_number
        return None

    def get_has_unpublished_changes(self, obj):
        """Check if there are unpublished changes"""
        published_version = None
        latest_version = None

        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            published_version = obj._published_versions_list[0]
        else:
            published_version = obj.get_current_published_version()

        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest_version = obj._all_versions_list[0]
        else:
            latest_version = obj.get_latest_version()

        if not latest_version:
            return False

        if not published_version:
            # Has versions but none published
            return True

        # Has unpublished changes if latest version is newer than published
        return latest_version.version_number > published_version.version_number

    # Scheduled version methods
    def get_scheduled_version_id(self, obj):
        """Get the ID of next scheduled version"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].id
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.id if scheduled_version else None

    def get_scheduled_version_number(self, obj):
        """Get the version number of next scheduled version"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].version_number
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.version_number if scheduled_version else None

    def get_scheduled_effective_date(self, obj):
        """Get the scheduled publication date"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].effective_date
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.effective_date if scheduled_version else None

    def _get_scheduled_version(self, obj):
        """Helper to get the next scheduled version"""
        from django.utils import timezone

        now = timezone.now()

        # Find the next version that will be published
        scheduled = (
            obj.versions.filter(effective_date__gt=now)
            .order_by("effective_date")
            .first()
        )

        return scheduled

    def validate(self, attrs):
        """Validate WebPage data including site_icon restrictions"""
        # Validate site_icon is only used for root pages
        if "site_icon" in attrs and attrs["site_icon"]:
            # Check if this is an update or create
            parent_id = attrs.get("parent_id")
            if parent_id is not None:  # Has a parent, not a root page
                raise serializers.ValidationError(
                    {
                        "site_icon": "Only root pages (pages without a parent) can have a site icon."
                    }
                )
            # For updates, check if the instance has a parent
            if self.instance and self.instance.parent_id is not None:
                raise serializers.ValidationError(
                    {
                        "site_icon": "Only root pages (pages without a parent) can have a site icon."
                    }
                )

        return super().validate(attrs)

    def create(self, validated_data):
        """Create a new WebPage with auto-slug uniqueness"""
        # Extract parent_id and set parent
        parent_id = validated_data.pop("parent_id", None)
        if parent_id:
            validated_data["parent"] = WebPage.objects.get(pk=parent_id)

        # Create the page instance (don't save yet)
        page = WebPage(**validated_data)

        # Ensure unique slug and track if modified
        slug_info = page.ensure_unique_slug()

        # Save the page
        page.save()

        # Store slug modification info in context for to_representation
        if slug_info["modified"]:
            self.context["slug_warning"] = {
                "field": "slug",
                "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                "original_value": slug_info["original_slug"],
            }

        return page

    def update(self, instance, validated_data):
        """Update a WebPage with auto-slug uniqueness"""
        # Extract parent_id and set parent if provided
        parent_id = validated_data.pop("parent_id", None)
        if parent_id is not None:
            validated_data["parent"] = (
                WebPage.objects.get(pk=parent_id) if parent_id else None
            )

        # Update instance fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Ensure unique slug if slug was changed
        if "slug" in validated_data:
            slug_info = instance.ensure_unique_slug()

            # Store slug modification info in context for to_representation
            if slug_info["modified"]:
                self.context["slug_warning"] = {
                    "field": "slug",
                    "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                    "original_value": slug_info["original_slug"],
                }

        # Save the instance
        instance.save()

        return instance

    def to_representation(self, instance):
        """Add warnings to representation if slug was modified"""
        data = super().to_representation(instance)

        # Add warnings if slug was auto-renamed
        if "slug_warning" in self.context:
            data["warnings"] = [self.context["slug_warning"]]
            # Clean up context to avoid leaking to other serializations
            del self.context["slug_warning"]

        return data


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


class DeletedPageSerializer(serializers.ModelSerializer):
    """Serializer for deleted pages with restoration metadata"""

    deleted_by_username = serializers.CharField(
        source="deleted_by.username", read_only=True
    )
    parent_path = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    can_restore = serializers.SerializerMethodField()
    restoration_warnings = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "deleted_at",
            "deleted_by_username",
            "deletion_metadata",
            "parent_path",
            "children_count",
            "can_restore",
            "restoration_warnings",
        ]
        read_only_fields = fields

    def get_parent_path(self, obj):
        """Get formatted parent path from deletion metadata"""
        if obj.deletion_metadata:
            return obj.deletion_metadata.get("parent_path_display", "Unknown")
        return "Unknown"

    def get_children_count(self, obj):
        """Get number of deleted children"""
        return obj.children.filter(is_deleted=True).count()

    def get_can_restore(self, obj):
        """Check if page can be restored (parent exists or can be relocated)"""
        if not obj.deletion_metadata:
            return True  # No metadata, assume can restore to current location

        original_parent_id = obj.deletion_metadata.get("parent_id")

        # Root page can always be restored
        if not original_parent_id:
            return True

        # Check if original parent exists
        if WebPage.objects.filter(id=original_parent_id, is_deleted=False).exists():
            return True

        # Check if any ancestor in chain exists
        parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
        for ancestor_id in parent_chain:
            if WebPage.objects.filter(id=ancestor_id, is_deleted=False).exists():
                return True

        # Can restore as root page
        return True

    def get_restoration_warnings(self, obj):
        """Get warnings about restoration (missing parent, slug conflicts)"""
        warnings = []

        if not obj.deletion_metadata:
            return warnings

        original_parent_id = obj.deletion_metadata.get("parent_id")

        # Check parent status
        if original_parent_id:
            if not WebPage.objects.filter(
                id=original_parent_id, is_deleted=False
            ).exists():
                # Find if alternative parent exists
                parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
                alternative_found = False

                for ancestor_id in parent_chain:
                    try:
                        ancestor = WebPage.objects.get(id=ancestor_id, is_deleted=False)
                        warnings.append(
                            f"Original parent no longer exists. Will be restored under '{ancestor.title or ancestor.slug}'"
                        )
                        alternative_found = True
                        break
                    except WebPage.DoesNotExist:
                        continue

                if not alternative_found:
                    warnings.append(
                        "Original parent no longer exists. Will be restored as root page"
                    )

        # Check for slug conflicts
        target_parent_id = original_parent_id
        if (
            original_parent_id
            and not WebPage.objects.filter(
                id=original_parent_id, is_deleted=False
            ).exists()
        ):
            # Need to find alternative parent for slug check
            parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
            for ancestor_id in parent_chain:
                if WebPage.objects.filter(id=ancestor_id, is_deleted=False).exists():
                    target_parent_id = ancestor_id
                    break
            else:
                target_parent_id = None

        # Check if slug conflicts with existing pages under target parent
        if obj.slug:
            conflicts = WebPage.objects.filter(
                parent_id=target_parent_id, slug=obj.slug, is_deleted=False
            ).exclude(id=obj.id)

            if conflicts.exists():
                warnings.append(
                    f"Slug '{obj.slug}' conflicts with existing page. Will be auto-renamed"
                )

        return warnings
