"""
Django REST Framework serializers for the Web Page Publishing System

Provides serialization and deserialization for all web page models,
including hierarchical relationships and inheritance logic.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import WebPage, PageVersion, PageTheme
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


# Temporarily disabled - widgets now stored in PageVersion JSON
# class PageWidgetSerializer(serializers.ModelSerializer):
#     """Serializer for page widgets"""
#
#     widget_type = WidgetTypeSerializer(read_only=True)
#     widget_type_id = serializers.IntegerField(write_only=True)
#     created_by = UserSerializer(read_only=True)
#
#     class Meta:
#         model = PageWidget
#         fields = [
#             "id",
#             "page",
#             "widget_type",
#             "widget_type_id",
#             "slot_name",
#             "sort_order",
#             "configuration",
#             "inherit_from_parent",
#             "override_parent",
#             # Phase 6: Enhanced inheritance and ordering fields
#             "inheritance_behavior",
#             "inheritance_conditions",
#             "priority",
#             "is_visible",
#             "max_inheritance_depth",
#             "created_at",
#             "updated_at",
#             "created_by",
#         ]
#         read_only_fields = ["id", "created_at", "updated_at", "created_by"]
#
#     def validate_configuration(self, value):
#         """Validate widget configuration against its type's schema"""
#         if not isinstance(value, dict):
#             raise serializers.ValidationError(
#                 "Widget configuration must be a JSON object"
#             )
#
#         # Phase 6: Implement JSON schema validation against widget_type.json_schema
#         widget_type_id = self.initial_data.get("widget_type_id")
#         if widget_type_id:
#             try:
#                 widget_type = WidgetType.objects.get(id=widget_type_id)
#                 is_valid, errors = widget_type.validate_configuration(value)
#                 if not is_valid:
#                     raise serializers.ValidationError(
#                         f"Configuration validation failed: {', '.join(errors)}"
#                     )
#             except WidgetType.DoesNotExist:
#                 pass  # Will be caught by widget_type_id validation
#
#         return value


#     def validate_inheritance_behavior(self, value):
#         """Validate inheritance behavior combinations"""
#         if value not in dict(PageWidget.INHERITANCE_CHOICES):
#             raise serializers.ValidationError(
#                 f"Invalid inheritance behavior. Must be one of: {[choice[0] for choice in PageWidget.INHERITANCE_CHOICES]}"
#             )
#         return value


class WebPageTreeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for page tree views"""

    children_count = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "parent",
            "sort_order",
            "hostnames",
            "publication_status",
            "effective_date",
            "expiry_date",
            "children_count",
        ]

    def get_children_count(self, obj):
        return obj.children.count()


class WebPageDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for individual page views"""

    parent = WebPageTreeSerializer(read_only=True)
    parent_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    # layout field removed - now using code-based layouts only

    theme = PageThemeSerializer(read_only=True)
    theme_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    # widgets = PageWidgetSerializer(many=True, read_only=True)  # Removed - widgets now in PageVersion

    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)

    # Computed fields
    absolute_url = serializers.SerializerMethodField()
    is_published = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    effective_layout = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    layout_type = serializers.SerializerMethodField()
    layout_inheritance_info = serializers.SerializerMethodField()
    available_code_layouts = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    # Enhanced CSS injection fields
    effective_css_data = serializers.SerializerMethodField()
    widget_css_data = serializers.SerializerMethodField()
    css_validation_status = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "parent",
            "parent_id",
            "sort_order",
            "hostnames",
            "code_layout",
            "theme",
            "theme_id",
            "page_css_variables",  # New field
            "page_custom_css",  # New field
            "enable_css_injection",  # New field
            "publication_status",
            "effective_date",
            "expiry_date",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "absolute_url",
            "is_published",
            "breadcrumbs",
            "effective_layout",
            "effective_theme",
            "layout_type",
            "layout_inheritance_info",
            "available_code_layouts",
            "children_count",
            "effective_css_data",  # New computed field
            "widget_css_data",  # New computed field
            "css_validation_status",  # New computed field
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
        ]

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

        return {
            "effective_layout": inheritance_info["effective_layout_dict"],
            "layout_type": inheritance_info["layout_type"],
            "inherited_from": (
                {
                    "id": inheritance_info["inherited_from"].id,
                    "title": inheritance_info["inherited_from"].title,
                }
                if inheritance_info["inherited_from"]
                else None
            ),
            "inheritance_chain": serialized_chain,
            "override_options": {
                "code_layouts": [
                    layout.to_dict()
                    for layout in inheritance_info["override_options"]["code_layouts"]
                ],
            },
        }

    def get_available_code_layouts(self, obj):
        """Get available code-based layouts for selection"""
        from .layout_registry import layout_registry

        return [
            layout.to_dict()
            for layout in layout_registry.list_layouts(active_only=True)
        ]

    def get_children_count(self, obj):
        return obj.children.count()

    def get_effective_css_data(self, obj):
        """Get all CSS data for this page"""
        try:
            return obj.get_effective_css_data()
        except Exception as e:
            # Handle gracefully if CSS system isn't fully integrated
            return {
                "error": str(e),
                "theme_css_variables": {},
                "page_css_variables": obj.page_css_variables or {},
                "enable_css_injection": obj.enable_css_injection,
            }

    def get_widget_css_data(self, obj):
        """Get widget-specific CSS data"""
        try:
            return obj.get_widget_css_data()
        except Exception as e:
            return {"error": str(e), "widgets_css": {}, "css_dependencies": []}

    def get_css_validation_status(self, obj):
        """Get CSS validation status for this page"""
        try:
            is_valid, errors, warnings = obj.validate_page_css()
            return {
                "is_valid": is_valid,
                "errors": errors,
                "warnings": warnings,
                "validated_at": timezone.now().isoformat(),
            }
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [f"Validation error: {str(e)}"],
                "warnings": [],
                "validated_at": timezone.now().isoformat(),
            }

    def validate_code_layout(self, value):
        """Validate that the code layout exists if specified"""
        if value:
            from .layout_registry import layout_registry

            if not layout_registry.is_registered(value):
                raise serializers.ValidationError(
                    f"Code layout '{value}' is not registered. "
                    f"Available layouts: {', '.join(layout_registry.get_layout_choices())}"
                )
        return value

    def validate(self, data):
        """Validate the entire page data"""
        # Validate parent relationship to prevent circular references
        if "parent_id" in data and data["parent_id"]:
            parent = WebPage.objects.get(id=data["parent_id"])
            current = parent
            while current:
                if current.id == self.instance.id if self.instance else None:
                    raise serializers.ValidationError(
                        "A page cannot be its own ancestor."
                    )
                current = current.parent

        # Validate effective and expiry dates
        effective_date = data.get("effective_date")
        expiry_date = data.get("expiry_date")
        if effective_date and expiry_date and effective_date >= expiry_date:
            raise serializers.ValidationError(
                "Effective date must be before expiry date."
            )

        return data


class WebPageListSerializer(serializers.ModelSerializer):
    """Serializer for page lists with essential fields"""

    parent = WebPageTreeSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    layout = serializers.SerializerMethodField()
    theme = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "parent",
            "sort_order",
            "hostnames",
            "publication_status",
            "effective_date",
            "expiry_date",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "is_published",
            "children_count",
            "layout",
            "theme",
        ]

    def get_is_published(self, obj):
        return obj.is_published()

    def get_children_count(self, obj):
        return obj.children.count()

    def get_layout(self, obj):
        layout = obj.get_effective_layout()
        return layout.to_dict() if layout else None

    def get_theme(self, obj):
        theme = obj.get_effective_theme()
        return PageThemeSerializer(theme).data if theme else None


class PageVersionSerializer(serializers.ModelSerializer):
    """Serializer for page versions with enhanced workflow support"""

    page = WebPageTreeSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    published_by = UserSerializer(read_only=True)

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "page",
            "version_number",
            "page_data",
            "widgets",
            "status",
            "description",
            "change_summary",
            "is_current",
            "published_at",
            "published_by",
            "created_at",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "version_number",
            "is_current",
            "published_at",
            "published_by",
            "created_at",
            "created_by",
        ]


class PageVersionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for version lists (without page_data)"""

    created_by = UserSerializer(read_only=True)
    published_by = UserSerializer(read_only=True)

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "version_number",
            "status",
            "description",
            "is_current",
            "published_at",
            "published_by",
            "created_at",
            "created_by",
        ]


class PageVersionComparisonSerializer(serializers.Serializer):
    """Serializer for version comparison results"""

    version1 = PageVersionListSerializer(read_only=True)
    version2 = PageVersionListSerializer(read_only=True)
    changes = serializers.JSONField(read_only=True)

    class Meta:
        fields = ["version1", "version2", "changes"]


class PageHierarchySerializer(serializers.ModelSerializer):
    """Recursive serializer for complete page hierarchy"""

    children = serializers.SerializerMethodField()

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

    def get_children(self, obj):
        children = obj.children.filter(publication_status="published").order_by(
            "sort_order", "title"
        )
        return PageHierarchySerializer(children, many=True, context=self.context).data
