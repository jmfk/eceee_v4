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


class WebPageTreeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for page tree views"""

    children_count = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

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

    def get_publication_status(self, obj):
        """Get the publication status for this page based on its current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.get_publication_status()

        # If no published version exists, check if there are any versions at all
        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        # No versions exist
        return "draft"

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None


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

    # Unified API: Add widgets field for unified save
    widgets = serializers.JSONField(required=False, allow_null=True)
    version_options = serializers.JSONField(write_only=True, required=False)

    # Version creation options (legacy support)
    auto_publish = serializers.BooleanField(
        write_only=True, required=False, default=False
    )
    version_description = serializers.CharField(
        write_only=True, required=False, default="API update"
    )

    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)

    # Computed fields
    absolute_url = serializers.SerializerMethodField()
    is_published = serializers.SerializerMethodField()
    current_published_version = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    effective_layout = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    layout_type = serializers.SerializerMethodField()
    layout_inheritance_info = serializers.SerializerMethodField()
    available_code_layouts = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

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
            "widgets",  # Unified API: Add widgets field
            "version_options",  # Unified API: Version options for saves
            "auto_publish",  # Legacy version option
            "version_description",  # Legacy version option
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "absolute_url",
            "is_published",
            "current_published_version",
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

    def get_current_published_version(self, obj):
        """Get the current published version using new date-based logic"""
        current_version = obj.get_current_published_version()
        if current_version:
            return {
                "id": current_version.id,
                "version_number": current_version.version_number,
                "effective_date": current_version.effective_date,
                "expiry_date": current_version.expiry_date,
                "publication_status": current_version.get_publication_status(),
                "description": current_version.description,
            }
        return None

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

    def get_publication_status(self, obj):
        """Get the publication status for this page based on its current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.get_publication_status()

        # If no published version exists, check if there are any versions at all
        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        # No versions exist
        return "draft"

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None

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

    # Unified API Methods
    def to_representation(self, instance):
        """Override to handle widgets field reading from current version"""
        data = super().to_representation(instance)

        # For reading, get widgets from current version
        current_version = instance.get_current_published_version()
        data["widgets"] = current_version.widgets if current_version else {}

        return data

    def update(self, instance, validated_data):
        """Handle unified save: page_data + widgets"""
        # Extract widgets and version options if present
        widgets_data = validated_data.pop("widgets", None)
        version_options = validated_data.pop("version_options", {})

        # Extract legacy version options
        legacy_auto_publish = validated_data.pop("auto_publish", None)
        legacy_description = validated_data.pop("version_description", None)

        # Update page metadata (existing logic)
        updated_instance = super().update(instance, validated_data)

        # Handle version creation/update based on options
        # Prefer version_options, fall back to legacy fields
        description = (
            version_options.get("description")
            or legacy_description
            or "Unified update via API"
        )
        auto_publish = (
            version_options.get("auto_publish", False)
            if version_options
            else legacy_auto_publish if legacy_auto_publish is not None else False
        )
        create_new_version = version_options.get(
            "create_new_version", True
        )  # Default to creating new version

        if create_new_version:
            # Create new version with both page_data and widgets (if any)
            self._create_unified_version(
                updated_instance, widgets_data or {}, description, auto_publish
            )
        else:
            # Update existing draft version instead of creating new one
            self._update_current_version(
                updated_instance, widgets_data or {}, description, auto_publish
            )

        return updated_instance

    def _create_unified_version(self, page, widgets_data, description, auto_publish):
        """Create version with both page data and widgets"""
        from django.utils import timezone

        # Get current page data by serializing the page (exclude computed fields)
        page_data_fields = [
            "title",
            "slug",
            "description",
            "sort_order",
            "hostnames",
            "code_layout",
            "page_css_variables",
            "page_custom_css",
            "enable_css_injection",
            "effective_date",
            "expiry_date",
            "meta_title",
            "meta_description",
            "meta_keywords",
        ]

        current_page_data = {}
        for field in page_data_fields:
            value = getattr(page, field, None)
            if value is not None:
                # Handle datetime fields
                if field in ["effective_date", "expiry_date"] and hasattr(
                    value, "isoformat"
                ):
                    current_page_data[field] = value.isoformat()
                else:
                    current_page_data[field] = value

        # Create new version
        version = page.create_version(
            user=self.context["request"].user,
            description=description,
        )

        # Update version with unified data
        version.page_data = current_page_data
        version.widgets = widgets_data

        # Handle auto_publish - set effective_date to now to make it published
        if auto_publish:
            from django.utils import timezone

            version.effective_date = timezone.now()

        version.save()

        return version

    def _update_current_version(self, page, widgets_data, description, auto_publish):
        """Update existing draft version instead of creating new one"""
        from django.utils import timezone

        # Find the latest draft version for this page
        latest_version = (
            page.versions.filter(
                effective_date__isnull=True  # Draft versions have no effective_date
            )
            .order_by("-version_number")
            .first()
        )

        if not latest_version:
            # If no draft version exists, create a new one
            return self._create_unified_version(
                page, widgets_data, description, auto_publish
            )

        # Get current page data (same logic as _create_unified_version)
        page_data_fields = [
            "title",
            "slug",
            "description",
            "code_layout",
            "linked_object_type",
            "linked_object_id",
            "sort_order",
            "enable_css_injection",
            "page_custom_css",
            "page_css_variables",
            "meta_title",
            "meta_description",
            "meta_keywords",
        ]

        current_page_data = {}
        for field in page_data_fields:
            value = getattr(page, field, None)
            if value is not None:
                # Handle datetime fields
                if field in ["effective_date", "expiry_date"] and hasattr(
                    value, "isoformat"
                ):
                    current_page_data[field] = value.isoformat()
                else:
                    current_page_data[field] = value

        # Update existing version
        latest_version.page_data = current_page_data
        latest_version.widgets = widgets_data
        latest_version.description = description

        # Handle auto_publish - set effective_date to now to make it published
        if auto_publish:
            latest_version.effective_date = timezone.now()

        latest_version.save()

        return latest_version


class WebPageListSerializer(serializers.ModelSerializer):
    """Serializer for page lists with essential fields"""

    parent = WebPageTreeSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    layout = serializers.SerializerMethodField()
    theme = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

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
            "publication_status",
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

    def get_publication_status(self, obj):
        """Get the publication status for this page based on its current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.get_publication_status()

        # If no published version exists, check if there are any versions at all
        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        # No versions exist
        return "draft"

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None


class PageVersionSerializer(serializers.ModelSerializer):
    """Serializer for page versions with enhanced workflow support"""

    page = WebPageTreeSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    published_by = UserSerializer(read_only=True)

    # New date-based publishing fields (computed)
    is_published = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "page",
            "version_number",
            "page_data",
            "widgets",
            # New date-based publishing fields
            "effective_date",
            "expiry_date",
            "is_published",
            "is_current_published",
            "publication_status",
            # Legacy fields (marked for removal in Phase 3)
            # "status", - REMOVED: This field no longer exists on PageVersion model
            "is_current",
            "published_at",
            "published_by",
            # Metadata
            "description",
            "change_summary",
            "created_at",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "version_number",
            "is_published",
            "is_current_published",
            "publication_status",
            "is_current",  # Legacy
            "published_at",  # Legacy
            "published_by",  # Legacy
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


class PageVersionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for version lists (without page_data)"""

    created_by = UserSerializer(read_only=True)
    published_by = UserSerializer(read_only=True)

    # New date-based publishing fields (computed)
    is_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "version_number",
            # New date-based publishing fields
            "effective_date",
            "expiry_date",
            "is_published",
            "publication_status",
            # Legacy fields (marked for removal in Phase 3)
            # "status", - REMOVED: This field no longer exists on PageVersion model
            "is_current",
            "published_at",
            "published_by",
            # Metadata
            "description",
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

    def get_children(self, obj):
        # Filter children that are published based on their versions
        published_children = []
        for child in obj.children.order_by("sort_order", "title"):
            if child.is_published():
                published_children.append(child)
        return PageHierarchySerializer(
            published_children, many=True, context=self.context
        ).data

    def get_publication_status(self, obj):
        """Get the publication status for this page based on its current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.get_publication_status()

        # If no published version exists, check if there are any versions at all
        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        # No versions exist
        return "draft"

    def get_effective_date(self, obj):
        """Get the effective date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.effective_date
        return None

    def get_expiry_date(self, obj):
        """Get the expiry date from the current published version"""
        current_version = obj.get_current_published_version()
        if current_version:
            return current_version.expiry_date
        return None
