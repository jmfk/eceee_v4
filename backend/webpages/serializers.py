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

    # NEW: Enhanced editor data for React components
    editor_data = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        # Extract template data inclusion flag from context
        self.include_template_data = kwargs.pop("include_template_data", False)
        self.include_editor_data = kwargs.pop("include_editor_data", False)
        if "context" in kwargs and kwargs["context"]:
            self.include_template_data = kwargs["context"].get(
                "include_template_data", False
            )
            self.include_editor_data = kwargs["context"].get(
                "include_editor_data", False
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

    def get_editor_data(self, obj):
        """
        Get enhanced editor data for React components when requested.

        This provides detailed template structure analysis and editor-specific
        instructions for rendering the layout in the React editor.
        """
        if not self.include_editor_data:
            return None

        try:
            from .template_parser import LayoutTemplateParser

            # Get layout object if this is a dict
            if isinstance(obj, dict):
                layout_name = obj.get("name")
                if layout_name:
                    from .layout_registry import layout_registry

                    layout_obj = layout_registry.get_layout(layout_name)
                    if not layout_obj:
                        return None
                else:
                    return None
            else:
                layout_obj = obj

            # Parse the template and extract structure
            parser = LayoutTemplateParser(layout_obj)

            return {
                "template_structure": parser.get_template_structure(),
                "slot_hierarchy": parser.get_slot_hierarchy(),
                "css_analysis": parser.get_css_analysis(),
                "editor_instructions": parser.get_editor_instructions(),
                "constraints": parser.get_layout_constraints(),
                "responsive_breakpoints": parser.get_responsive_info(),
                "accessibility_info": parser.get_accessibility_info(),
                "validation_rules": parser.get_validation_rules(),
            }

        except ImportError:
            # Template parser not available yet
            return self._get_basic_editor_data(obj)
        except Exception as e:
            # Log error and return basic data
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to parse template for editor data: {e}")
            return self._get_basic_editor_data(obj)

    def _get_basic_editor_data(self, obj):
        """
        Fallback method to provide basic editor data when template parser is not available.
        """
        if isinstance(obj, dict):
            slot_config = obj.get("slot_configuration", {})
            layout_name = obj.get("name", "unknown")
            template_name = obj.get("template_name", "")
            css_classes = obj.get("css_classes", "")
        else:
            slot_config = (
                getattr(obj, "slot_configuration", {})
                if hasattr(obj, "slot_configuration")
                else {}
            )
            layout_name = getattr(obj, "name", "unknown")
            template_name = getattr(obj, "template_name", "")
            css_classes = getattr(obj, "css_classes", "")

        slots = slot_config.get("slots", [])

        return {
            "layout_type": self._infer_layout_type(layout_name, len(slots)),
            "slot_summary": {
                "total_slots": len(slots),
                "slots": [
                    {
                        "name": slot.get("name", ""),
                        "title": slot.get("title", ""),
                        "description": slot.get("description", ""),
                        "max_widgets": slot.get("max_widgets"),
                        "css_classes": slot.get("css_classes", ""),
                        "position": idx,
                        "is_required": idx == 0,  # Assume first slot is main content
                        "accepts_all_widgets": slot.get("max_widgets") is None,
                    }
                    for idx, slot in enumerate(slots)
                ],
            },
            "editor_metadata": {
                "template_file": template_name,
                "base_css_classes": css_classes,
                "is_responsive": "responsive" in css_classes.lower()
                or "col" in css_classes.lower(),
                "complexity_level": (
                    "basic"
                    if len(slots) <= 2
                    else "intermediate" if len(slots) <= 4 else "advanced"
                ),
                "recommended_use_cases": self._get_use_cases(layout_name, len(slots)),
            },
            "basic_structure": {
                "container_classes": css_classes,
                "slot_layout": self._infer_slot_layout(slots),
                "hierarchy": "flat",  # Basic fallback
            },
        }

    def _infer_layout_type(self, layout_name, slot_count):
        """Infer layout type from name and slot count."""
        name_lower = layout_name.lower()
        if "single" in name_lower or slot_count <= 2:
            return "single_column"
        elif "two" in name_lower or "sidebar" in name_lower:
            return "two_column"
        elif "three" in name_lower:
            return "three_column"
        elif "grid" in name_lower:
            return "grid"
        elif "hero" in name_lower:
            return "hero"
        else:
            return "custom"

    def _get_use_cases(self, layout_name, slot_count):
        """Get recommended use cases based on layout characteristics."""
        use_cases = []
        name_lower = layout_name.lower()

        if "single" in name_lower:
            use_cases = ["blog_posts", "articles", "simple_pages"]
        elif "two" in name_lower or "sidebar" in name_lower:
            use_cases = ["documentation", "product_pages", "landing_pages"]
        elif "three" in name_lower:
            use_cases = ["dashboards", "complex_layouts", "portal_pages"]
        elif "hero" in name_lower:
            use_cases = ["landing_pages", "marketing_pages", "home_pages"]
        elif "grid" in name_lower:
            use_cases = ["portfolios", "galleries", "product_catalogs"]
        else:
            use_cases = ["general_purpose"]

        return use_cases

    def _infer_slot_layout(self, slots):
        """Infer the visual layout pattern of slots."""
        if len(slots) <= 1:
            return "single"
        elif len(slots) == 2:
            return (
                "vertical"
                if any("footer" in slot.get("name", "") for slot in slots)
                else "horizontal"
            )
        elif len(slots) == 3:
            # Check for header/main/footer pattern
            slot_names = [slot.get("name", "").lower() for slot in slots]
            if "header" in slot_names and "footer" in slot_names:
                return "header_main_footer"
            else:
                return "three_column"
        else:
            return "complex_grid"


class EnhancedLayoutSerializer(LayoutSerializer):
    """
    Enhanced layout serializer that always includes editor data.

    This is a convenience serializer for the React editor that automatically
    includes all the detailed template and editor information.
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("include_template_data", True)
        kwargs.setdefault("include_editor_data", True)
        if "context" in kwargs and kwargs["context"]:
            kwargs["context"].setdefault("include_template_data", True)
            kwargs["context"].setdefault("include_editor_data", True)
        super().__init__(*args, **kwargs)


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
