"""
Django REST Framework serializers for the Web Page Publishing System

Provides serialization and deserialization for all web page models,
including hierarchical relationships and inheritance logic.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import WebPage, PageVersion, PageTheme, PageDataSchema
from django.utils import timezone


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
            "custom_css",
            "is_active",
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
    layout_type = serializers.SerializerMethodField()
    layout_inheritance_info = serializers.SerializerMethodField()
    available_code_layouts = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
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
            "layout_type",
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

    def get_current_published_version(self, obj):
        """DEPRECATED: Get version info via PageVersionViewSet instead"""
        # For backward compatibility, return None
        # To get actual version data, use the PageVersionViewSet API
        return None

    def get_code_layout(self, obj):
        """Get code layout - NOTE: This field is deprecated, use PageVersionSerializer instead"""
        # For backward compatibility, return empty string
        # To get actual code_layout, query the PageVersion directly
        return ""

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
            "layout_type": inheritance_info["layout_type"],
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

    # page = WebPageTreeSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)

    # New date-based publishing fields (computed)
    is_published = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    hostnames = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "version_id",
            "page",
            "version_number",
            "version_title",
            "title",
            "description",
            "slug",
            "hostnames",
            "code_layout",
            "page_data",
            "widgets",
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

    def get_id(self, obj):
        """Page Id for this version"""
        return obj.page.id

    def get_version_id(self, obj):
        """Version Id for this version"""
        return obj.id

    def get_is_published(self, obj):
        """Check if this version is currently published based on dates"""
        return obj.is_published()

    def get_is_current_published(self, obj):
        """Check if this is the current published version for its page"""
        return obj.is_current_published()

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()

    def get_title(self, obj):
        """Get title from the page"""
        return obj.page.title

    def get_description(self, obj):
        """Get description from the page"""
        return obj.page.description

    def get_hostnames(self, obj):
        """Get hostnames from the page"""
        return obj.page.hostnames

    def get_slug(self, obj):
        """Get slug from the page"""
        return obj.page.slug

    def validate(self, attrs):
        # Strip forbidden keys from page_data on write
        page_data = attrs.get("page_data")
        if isinstance(page_data, dict):
            excluded_keys = {"title", "slug", "code_layout", "description", "hostnames"}
            attrs["page_data"] = {
                k: v for k, v in page_data.items() if k not in excluded_keys
            }
        return super().validate(attrs)


class PageDataSchemaSerializer(serializers.ModelSerializer):
    """Serializer for page data JSON Schemas (system and layout scopes)."""

    created_by = UserSerializer(read_only=True)

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
        # Validate basic constraints: layout_name must be present for layout scope
        scope = data.get("scope", getattr(self.instance, "scope", None))
        layout_name = data.get("layout_name", getattr(self.instance, "layout_name", ""))
        if scope == PageDataSchema.SCOPE_LAYOUT and not layout_name:
            raise serializers.ValidationError(
                "layout_name is required for layout scope"
            )

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
