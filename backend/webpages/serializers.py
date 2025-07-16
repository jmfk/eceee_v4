"""
Django REST Framework serializers for the Web Page Publishing System

Provides serialization and deserialization for all web page models,
including hierarchical relationships and inheritance logic.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import WebPage, PageVersion, PageLayout, PageTheme, WidgetType, PageWidget


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer for references"""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]
        read_only_fields = ["id"]


class PageLayoutSerializer(serializers.ModelSerializer):
    """Serializer for page layouts"""

    created_by = UserSerializer(read_only=True)

    class Meta:
        model = PageLayout
        fields = [
            "id",
            "name",
            "description",
            "slot_configuration",
            "css_classes",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate_slot_configuration(self, value):
        """Validate that slot_configuration is a valid JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Slot configuration must be a JSON object"
            )

        # Validate that slots are defined
        if "slots" not in value:
            raise serializers.ValidationError(
                "Slot configuration must contain a 'slots' key"
            )

        if not isinstance(value["slots"], list):
            raise serializers.ValidationError("Slots must be a list")

        # Validate each slot
        for slot in value["slots"]:
            if not isinstance(slot, dict):
                raise serializers.ValidationError("Each slot must be an object")
            if "name" not in slot:
                raise serializers.ValidationError("Each slot must have a 'name' field")

        return value


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


class WidgetTypeSerializer(serializers.ModelSerializer):
    """Serializer for widget types"""

    created_by = UserSerializer(read_only=True)

    class Meta:
        model = WidgetType
        fields = [
            "id",
            "name",
            "description",
            "json_schema",
            "template_name",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate_json_schema(self, value):
        """Validate that json_schema is a valid JSON schema structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("JSON schema must be a JSON object")

        # Basic JSON schema validation
        required_fields = ["type", "properties"]
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(
                    f"JSON schema must contain '{field}' field"
                )

        return value


class PageWidgetSerializer(serializers.ModelSerializer):
    """Serializer for page widgets"""

    widget_type = WidgetTypeSerializer(read_only=True)
    widget_type_id = serializers.IntegerField(write_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = PageWidget
        fields = [
            "id",
            "page",
            "widget_type",
            "widget_type_id",
            "slot_name",
            "sort_order",
            "configuration",
            "inherit_from_parent",
            "override_parent",
            # Phase 6: Enhanced inheritance and ordering fields
            "inheritance_behavior",
            "inheritance_conditions",
            "priority",
            "is_visible",
            "max_inheritance_depth",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate_configuration(self, value):
        """Validate widget configuration against its type's schema"""
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Widget configuration must be a JSON object"
            )

        # Phase 6: Implement JSON schema validation against widget_type.json_schema
        widget_type_id = self.initial_data.get("widget_type_id")
        if widget_type_id:
            try:
                widget_type = WidgetType.objects.get(id=widget_type_id)
                is_valid, errors = widget_type.validate_configuration(value)
                if not is_valid:
                    raise serializers.ValidationError(
                        f"Configuration validation failed: {', '.join(errors)}"
                    )
            except WidgetType.DoesNotExist:
                pass  # Will be caught by widget_type_id validation

        return value

    def validate_inheritance_behavior(self, value):
        """Validate inheritance behavior combinations"""
        if value not in dict(PageWidget.INHERITANCE_CHOICES):
            raise serializers.ValidationError(
                f"Invalid inheritance behavior. Must be one of: {[choice[0] for choice in PageWidget.INHERITANCE_CHOICES]}"
            )
        return value


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

    layout = PageLayoutSerializer(read_only=True)
    layout_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    theme = PageThemeSerializer(read_only=True)
    theme_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    widgets = PageWidgetSerializer(many=True, read_only=True)

    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)

    # Computed fields
    absolute_url = serializers.SerializerMethodField()
    is_published = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    effective_layout = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

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
            "layout",
            "layout_id",
            "theme",
            "theme_id",
            "publication_status",
            "effective_date",
            "expiry_date",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "linked_object_type",
            "linked_object_id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "widgets",
            "absolute_url",
            "is_published",
            "breadcrumbs",
            "effective_layout",
            "effective_theme",
            "children_count",
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
        layout = obj.get_effective_layout()
        return PageLayoutSerializer(layout).data if layout else None

    def get_effective_theme(self, obj):
        theme = obj.get_effective_theme()
        return PageThemeSerializer(theme).data if theme else None

    def get_children_count(self, obj):
        return obj.children.count()

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
        return PageLayoutSerializer(layout).data if layout else None

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
