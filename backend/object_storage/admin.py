"""
Django Admin Configuration for Object Storage System

Provides administrative interfaces for managing object types and instances.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
import json

from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion


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
    readonly_fields = ["version_number", "created_by", "created_at"]
    fields = ["version_number", "change_description", "created_by", "created_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        """Versions are created automatically, not manually."""
        return False


@admin.register(ObjectInstance)
class ObjectInstanceAdmin(admin.ModelAdmin):
    """Admin interface for Object Instances."""

    list_display = [
        "title",
        "object_type",
        "status",
        "is_published_display",
        "version",
        "created_by",
        "created_at",
    ]
    list_filter = [
        "object_type",
        "status",
        "created_at",
        "updated_at",
        "publish_date",
    ]
    search_fields = ["title", "slug"]
    readonly_fields = [
        "slug",
        "version",
        "current_version",
        "created_at",
        "updated_at",
        "data_preview",
        "widgets_preview",
        "is_published_display",
    ]
    inlines = [ObjectVersionInline]

    fieldsets = (
        ("Basic Information", {"fields": ("object_type", "title", "slug", "status")}),
        (
            "Publishing",
            {
                "fields": ("publish_date", "unpublish_date", "is_published_display"),
                "description": "Control when this object is published",
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
        "object",
        "version_number",
        "created_by",
        "created_at",
        "change_description_short",
    ]
    list_filter = ["created_at", "object__object_type"]
    search_fields = ["object__title", "change_description"]
    readonly_fields = [
        "object",
        "version_number",
        "data",
        "widgets",
        "created_by",
        "created_at",
        "data_preview",
    ]

    fieldsets = (
        (
            "Version Information",
            {"fields": ("object", "version_number", "change_description")},
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
            .select_related("object", "object__object_type", "created_by")
        )
