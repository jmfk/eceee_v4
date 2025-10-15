"""
Django Admin Configuration for Object Storage System

Provides administrative interfaces for managing object types and instances.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.db import models
from django.forms import ModelChoiceField
from django.forms.widgets import Widget
import json

from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion


class ObjectReferenceWidget(Widget):
    """
    Custom widget for object_reference fields in Django admin.
    Provides search, autocomplete, and direct PK entry.
    """

    template_name = "admin/widgets/object_reference.html"

    def __init__(self, field_config=None, attrs=None):
        super().__init__(attrs)
        self.field_config = field_config or {}

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)

        # Parse value
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                value = []

        # Ensure value is in correct format
        if not isinstance(value, list):
            value = [value] if value else []

        context["widget"].update(
            {
                "field_name": name,
                "value_json": json.dumps(value),
                "field_config_json": json.dumps(self.field_config),
                "allowed_types": self.field_config.get("allowed_object_types", []),
                "max_items": self.field_config.get("max_items"),
                "multiple": self.field_config.get("multiple", False),
            }
        )

        return context

    def value_from_datadict(self, data, files, name):
        """Extract value from POST data"""
        value = data.get(name, "")
        if not value:
            return [] if self.field_config.get("multiple", False) else None

        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return [] if self.field_config.get("multiple", False) else None


@admin.register(ObjectTypeDefinition)
class ObjectTypeDefinitionAdmin(admin.ModelAdmin):
    """Admin interface for Object Type Definitions."""

    list_display = [
        "label",
        "name",
        "plural_label",
        "is_active",
        "schema_fields_count",
        "slots_count",
        "child_types_count",
        "created_at",
    ]
    list_filter = ["is_active", "created_at", "updated_at"]
    search_fields = ["name", "label", "plural_label", "description"]
    readonly_fields = ["created_at", "updated_at", "schema_preview", "slot_preview"]
    filter_horizontal = ["allowed_child_types"]

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "name",
                    "label",
                    "plural_label",
                    "description",
                    "icon_image",
                    "is_active",
                )
            },
        ),
        (
            "Schema Configuration",
            {
                "fields": ("schema", "schema_preview"),
                "description": "Define the data fields for this object type",
            },
        ),
        (
            "Widget Slots",
            {
                "fields": ("slot_configuration", "slot_preview"),
                "description": "Configure widget slots and restrictions",
            },
        ),
        (
            "Relationships",
            {
                "fields": ("allowed_child_types",),
                "description": "Define which object types can be children of this type",
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        """Set the created_by field when creating new objects."""
        if not change:  # Creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def schema_fields_count(self, obj):
        """Display count of schema fields."""
        return len(obj.get_schema_fields())

    schema_fields_count.short_description = "Fields"

    def slots_count(self, obj):
        """Display count of widget slots."""
        return len(obj.get_slots())

    slots_count.short_description = "Slots"

    def child_types_count(self, obj):
        """Display count of allowed child types."""
        return obj.allowed_child_types.count()

    child_types_count.short_description = "Child Types"

    def schema_preview(self, obj):
        """Display a formatted preview of the schema."""
        if not obj.schema:
            return "No schema defined"

        fields = obj.get_schema_fields()
        if not fields:
            return "No fields defined"

        html = "<ul>"
        for field in fields:
            required = " (required)" if field.get("required", False) else ""
            html += (
                f"<li><strong>{field['name']}</strong>: {field['type']}{required}</li>"
            )
        html += "</ul>"
        return mark_safe(html)

    schema_preview.short_description = "Schema Preview"

    def slot_preview(self, obj):
        """Display a formatted preview of the slot configuration."""
        if not obj.slot_configuration:
            return "No slots defined"

        slots = obj.get_slots()
        if not slots:
            return "No slots defined"

        html = "<ul>"
        for slot in slots:
            required = " (required)" if slot.get("required", False) else ""
            html += (
                f"<li><strong>{slot['name']}</strong>: {slot['label']}{required}</li>"
            )
        html += "</ul>"
        return mark_safe(html)

    slot_preview.short_description = "Slots Preview"


class ObjectVersionInline(admin.TabularInline):
    """Inline admin for object versions."""

    model = ObjectVersion
    extra = 0
    readonly_fields = [
        "version_number",
        "created_by",
        "created_at",
        "version_link",
        "publication_status_display",
    ]
    fields = [
        "version_number",
        "version_link",
        "change_description",
        "effective_date",
        "expiry_date",
        "publication_status_display",
        "created_by",
        "created_at",
    ]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        """Versions are created automatically, not manually."""
        return False

    def version_link(self, obj):
        """Display a link to view the object version in admin."""
        if obj.pk:
            url = reverse("admin:object_storage_objectversion_change", args=[obj.pk])
            return format_html('<a href="{}">View Version</a>', url)
        return "Not saved yet"

    version_link.short_description = "View"

    def publication_status_display(self, obj):
        """Display publication status with color coding."""
        if not obj.pk:
            return "-"

        status = obj.get_publication_status()
        colors = {
            "draft": "gray",
            "scheduled": "orange",
            "published": "green",
            "expired": "red",
        }
        color = colors.get(status, "black")
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            status.title(),
        )

    publication_status_display.short_description = "Status"


class SubObjectInline(admin.TabularInline):
    """Inline admin for managing sub-objects (children)."""

    model = ObjectInstance
    fk_name = "parent"
    extra = 0
    fields = ["object_type", "title", "status", "is_published_display_inline"]
    readonly_fields = ["is_published_display_inline"]

    def is_published_display_inline(self, obj):
        """Display publication status in inline."""
        if not obj.pk:
            return "-"
        if obj.is_published():
            return format_html('<span style="color: green;">✓ Published</span>')
        else:
            return format_html('<span style="color: red;">✗ Draft</span>')

    is_published_display_inline.short_description = "Published"

    def get_queryset(self, request):
        """Optimize queryset for inline display."""
        return super().get_queryset(request).select_related("object_type")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Filter object types to only show allowed child types."""
        if db_field.name == "object_type":
            # Get the parent object from the request
            parent_id = request.resolver_match.kwargs.get("object_id")
            if parent_id:
                try:
                    parent = ObjectInstance.objects.get(pk=parent_id)
                    # Filter to only allowed child types
                    kwargs["queryset"] = parent.object_type.allowed_child_types.filter(
                        is_active=True
                    )
                except ObjectInstance.DoesNotExist:
                    pass
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(ObjectInstance)
class ObjectInstanceAdmin(admin.ModelAdmin):
    """Admin interface for Object Instances."""

    list_display = [
        "hierarchical_title",
        "object_type",
        "parent_link",
        "children_count",
        "status",
        "is_published_display",
        "version",
        "created_by",
        "created_at",
    ]
    list_filter = [
        "object_type",
        "status",
        "parent",
        "level",
        "created_at",
        "updated_at",
    ]
    search_fields = ["title", "slug"]
    readonly_fields = [
        "slug",
        "version",
        "current_version",
        "level",
        "tree_id",
        "created_at",
        "updated_at",
        "data_preview",
        "widgets_preview",
        "is_published_display",
        "current_published_version_info",
        "children_count",
        "relationships_display",
        "related_from_display",
    ]
    inlines = [ObjectVersionInline, SubObjectInline]

    fieldsets = (
        ("Basic Information", {"fields": ("object_type", "title", "slug", "status")}),
        (
            "Hierarchy",
            {
                "fields": ("parent", "level", "tree_id", "children_count"),
                "description": "Parent-child relationships and tree structure",
            },
        ),
        (
            "Publishing",
            {
                "fields": ("is_published_display", "current_published_version_info"),
                "description": "Publication status is now controlled at the version level",
            },
        ),
        (
            "Version Control",
            {
                "fields": (
                    "current_version",
                    "version",
                    "data_preview",
                    "widgets_preview",
                ),
                "description": "Current version and content preview - edit content through versions",
            },
        ),
        (
            "Relationships",
            {
                "fields": ("relationships_display", "related_from_display"),
                "description": "Many-to-many relationships with other objects",
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        """Set the created_by field and handle versioning."""
        if not change:  # Creating new object
            obj.created_by = request.user
        else:  # Updating existing object
            # Version creation will be handled by the serializer when data/widgets change
            pass

        super().save_model(request, obj, form, change)

    def is_published_display(self, obj):
        """Display publication status with color coding."""
        if obj.is_published():
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Published</span>'
            )
        else:
            return format_html('<span style="color: red;">✗ Not Published</span>')

    is_published_display.short_description = "Published"

    def current_published_version_info(self, obj):
        """Display information about the current published version."""
        current_pub_version = obj.get_current_published_version()
        if current_pub_version:
            return format_html(
                "Version {} (effective: {}, expires: {})",
                current_pub_version.version_number,
                (
                    current_pub_version.effective_date.strftime("%Y-%m-%d %H:%M")
                    if current_pub_version.effective_date
                    else "N/A"
                ),
                (
                    current_pub_version.expiry_date.strftime("%Y-%m-%d %H:%M")
                    if current_pub_version.expiry_date
                    else "Never"
                ),
            )
        else:
            return format_html('<span style="color: gray;">No published version</span>')

    current_published_version_info.short_description = "Current Published Version"

    def data_preview(self, obj):
        """Display a formatted preview of the object data."""
        if not obj.data:
            return "No data"

        html = "<table style='width: 100%; font-size: 12px;'>"
        for key, value in obj.data.items():
            # Truncate long values
            display_value = str(value)
            if len(display_value) > 100:
                display_value = display_value[:97] + "..."
            html += f"<tr><td style='font-weight: bold; width: 30%;'>{key}:</td><td>{display_value}</td></tr>"
        html += "</table>"
        return mark_safe(html)

    data_preview.short_description = "Data Preview"

    def widgets_preview(self, obj):
        """Display a formatted preview of the widget configuration."""
        if not obj.widgets:
            return "No widgets configured"

        html = "<ul style='font-size: 12px;'>"
        for slot_name, widgets in obj.widgets.items():
            widget_count = len(widgets) if isinstance(widgets, list) else 1
            html += f"<li><strong>{slot_name}</strong>: {widget_count} widget(s)</li>"
        html += "</ul>"
        return mark_safe(html)

    widgets_preview.short_description = "Widgets Preview"

    def hierarchical_title(self, obj):
        """Display title with indentation to show hierarchy."""
        indent = "—" * (obj.level or 0) * 2
        if indent:
            return format_html("{} {}", indent, obj.title)
        return obj.title

    hierarchical_title.short_description = "Title"
    hierarchical_title.admin_order_field = "title"

    def parent_link(self, obj):
        """Display a link to the parent object."""
        if obj.parent:
            url = reverse(
                "admin:object_storage_objectinstance_change", args=[obj.parent.pk]
            )
            return format_html('<a href="{}">{}</a>', url, obj.parent.title)
        return "—"

    parent_link.short_description = "Parent"
    parent_link.admin_order_field = "parent__title"

    def children_count(self, obj):
        """Display count of child objects."""
        count = obj.children.count()
        if count > 0:
            # Link to filtered view showing only children
            url = f"/admin/object_storage/objectinstance/?parent__id__exact={obj.pk}"
            return format_html('<a href="{}">{} children</a>', url, count)
        return "0"

    children_count.short_description = "Children"

    def relationships_display(self, obj):
        """Display forward relationships grouped by type."""
        if not obj.relationships:
            return "No relationships"

        # Group relationships by type
        by_type = {}
        for rel in obj.relationships:
            rel_type = rel.get("type", "unknown")
            if rel_type not in by_type:
                by_type[rel_type] = []
            by_type[rel_type].append(rel.get("object_id"))

        html = "<div style='font-size: 12px;'>"
        for rel_type, obj_ids in by_type.items():
            html += f"<div style='margin-bottom: 10px;'>"
            html += f"<strong>{rel_type}</strong> ({len(obj_ids)}):<br/>"

            # Get the related objects
            from object_storage.models import ObjectInstance

            related_objs = ObjectInstance.objects.filter(id__in=obj_ids)

            # Create dict for quick lookup
            obj_dict = {o.id: o for o in related_objs}

            html += "<ul style='margin: 5px 0 0 20px;'>"
            for obj_id in obj_ids:
                related_obj = obj_dict.get(obj_id)
                if related_obj:
                    url = reverse(
                        "admin:object_storage_objectinstance_change",
                        args=[related_obj.pk],
                    )
                    html += f"<li><a href='{url}'>{related_obj.title}</a> ({related_obj.object_type.label})</li>"
                else:
                    html += f"<li><em>Object #{obj_id} (deleted)</em></li>"
            html += "</ul>"
            html += "</div>"
        html += "</div>"

        return mark_safe(html)

    relationships_display.short_description = "Related Objects (Forward)"

    def related_from_display(self, obj):
        """Display reverse relationships grouped by type."""
        if not obj.related_from:
            return "No reverse relationships"

        # Group relationships by type
        by_type = {}
        for rel in obj.related_from:
            rel_type = rel.get("type", "unknown")
            if rel_type not in by_type:
                by_type[rel_type] = []
            by_type[rel_type].append(rel.get("object_id"))

        html = "<div style='font-size: 12px;'>"
        for rel_type, obj_ids in by_type.items():
            html += f"<div style='margin-bottom: 10px;'>"
            html += f"<strong>{rel_type}</strong> ({len(obj_ids)}):<br/>"

            # Get the related objects
            from object_storage.models import ObjectInstance

            related_objs = ObjectInstance.objects.filter(id__in=obj_ids)

            # Create dict for quick lookup
            obj_dict = {o.id: o for o in related_objs}

            html += "<ul style='margin: 5px 0 0 20px;'>"
            for obj_id in obj_ids:
                related_obj = obj_dict.get(obj_id)
                if related_obj:
                    url = reverse(
                        "admin:object_storage_objectinstance_change",
                        args=[related_obj.pk],
                    )
                    html += f"<li><a href='{url}'>{related_obj.title}</a> ({related_obj.object_type.label})</li>"
                else:
                    html += f"<li><em>Object #{obj_id} (deleted)</em></li>"
            html += "</ul>"
            html += "</div>"
        html += "</div>"

        return mark_safe(html)

    related_from_display.short_description = "Related From (Reverse)"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Customize the parent field to show only valid parents."""
        if db_field.name == "parent":
            # Get current object type from the form
            obj_id = request.resolver_match.kwargs.get("object_id")
            if obj_id:
                try:
                    current_obj = ObjectInstance.objects.select_related(
                        "object_type"
                    ).get(pk=obj_id)
                    # Filter to only show objects that can have this object type as child
                    valid_parent_types = ObjectTypeDefinition.objects.filter(
                        allowed_child_types=current_obj.object_type
                    )
                    kwargs["queryset"] = ObjectInstance.objects.filter(
                        object_type__in=valid_parent_types
                    ).exclude(
                        pk=obj_id
                    )  # Don't allow self as parent
                except ObjectInstance.DoesNotExist:
                    pass
            else:
                # For new objects, we can't filter yet since we don't know the object type
                kwargs["queryset"] = ObjectInstance.objects.all()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_queryset(self, request):
        """Optimize queries by selecting related objects."""
        return (
            super()
            .get_queryset(request)
            .select_related("object_type", "parent", "created_by")
        )


@admin.register(ObjectVersion)
class ObjectVersionAdmin(admin.ModelAdmin):
    """Admin interface for Object Versions."""

    list_display = [
        "object_instance",
        "version_number",
        "publication_status_display",
        "effective_date",
        "expiry_date",
        "created_by",
        "created_at",
        "change_description_short",
    ]
    list_filter = [
        "created_at",
        "effective_date",
        "expiry_date",
        "object_instance__object_type",
    ]
    search_fields = ["object_instance__title", "change_description"]
    readonly_fields = [
        "object_instance",
        "version_number",
        "data",
        "widgets",
        "created_by",
        "created_at",
        "data_preview",
        "publication_status_display",
        "is_published_display",
    ]

    fieldsets = (
        (
            "Version Information",
            {"fields": ("object_instance", "version_number", "change_description")},
        ),
        (
            "Publication Schedule",
            {
                "fields": (
                    "effective_date",
                    "expiry_date",
                    "publication_status_display",
                    "is_published_display",
                ),
                "description": "Control when this version is published and expires",
            },
        ),
        (
            "Snapshot Data",
            {
                "fields": ("data", "data_preview", "widgets"),
                "description": "Data and widget configuration at this version",
            },
        ),
        (
            "Metadata",
            {"fields": ("created_by", "created_at")},
        ),
    )

    def has_add_permission(self, request):
        """Versions are created automatically, not manually."""
        return False

    def has_change_permission(self, request, obj=None):
        """Versions should not be editable."""
        return False

    def change_description_short(self, obj):
        """Display truncated change description."""
        if not obj.change_description:
            return "No description"
        return (
            obj.change_description[:50] + "..."
            if len(obj.change_description) > 50
            else obj.change_description
        )

    change_description_short.short_description = "Description"

    def publication_status_display(self, obj):
        """Display publication status with color coding."""
        status = obj.get_publication_status()
        colors = {
            "draft": "gray",
            "scheduled": "orange",
            "published": "green",
            "expired": "red",
        }
        color = colors.get(status, "black")
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            status.title(),
        )

    publication_status_display.short_description = "Publication Status"

    def is_published_display(self, obj):
        """Display current publication state."""
        if obj.is_published():
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Currently Published</span>'
            )
        else:
            return format_html('<span style="color: red;">✗ Not Published</span>')

    is_published_display.short_description = "Currently Published"

    def data_preview(self, obj):
        """Display a formatted preview of the version data."""
        if not obj.data:
            return "No data"

        html = "<table style='width: 100%; font-size: 12px;'>"
        for key, value in obj.data.items():
            display_value = str(value)
            if len(display_value) > 100:
                display_value = display_value[:97] + "..."
            html += f"<tr><td style='font-weight: bold; width: 30%;'>{key}:</td><td>{display_value}</td></tr>"
        html += "</table>"
        return mark_safe(html)

    data_preview.short_description = "Data Preview"

    def get_queryset(self, request):
        """Optimize queries by selecting related objects."""
        return (
            super()
            .get_queryset(request)
            .select_related(
                "object_instance", "object_instance__object_type", "created_by"
            )
        )
