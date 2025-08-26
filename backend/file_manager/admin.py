"""
Django admin configuration for file manager models.

Provides comprehensive admin interface for managing media files, tags,
collections, and usage tracking.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import MediaFile, MediaTag, MediaCollection, MediaUsage, PendingMediaFile


@admin.register(MediaTag)
class MediaTagAdmin(admin.ModelAdmin):
    """Admin interface for media tags."""

    list_display = [
        "name",
        "slug",
        "color_display",
        "namespace",
        "created_at",
        "created_by",
    ]
    list_filter = ["namespace", "created_at", "created_by"]
    search_fields = ["name", "slug", "description"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["created_at", "created_by"]

    fieldsets = (
        (None, {"fields": ("name", "slug", "description", "color", "namespace")}),
        (
            "Metadata",
            {"fields": ("created_at", "created_by"), "classes": ("collapse",)},
        ),
    )

    def color_display(self, obj):
        """Display color as a colored box."""
        return format_html(
            '<div style="width: 20px; height: 20px; background-color: {}; border: 1px solid #ccc;"></div>',
            obj.color,
        )

    color_display.short_description = "Color"

    def save_model(self, request, obj, form, change):
        """Set created_by when saving."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


class MediaUsageInline(admin.TabularInline):
    """Inline admin for media usage tracking."""

    model = MediaUsage
    extra = 0
    readonly_fields = [
        "usage_type",
        "object_id",
        "object_type",
        "field_name",
        "created_at",
        "created_by",
    ]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    """Admin interface for media files."""

    list_display = [
        "title",
        "slug",
        "file_type",
        "file_size_display",
        "dimensions_display",
        "namespace",
        "access_level",
        "created_at",
        "created_by",
    ]
    list_filter = [
        "file_type",
        "access_level",
        "namespace",
        "created_at",
        "created_by",
        "tags",
    ]
    search_fields = [
        "title",
        "slug",
        "description",
        "original_filename",
        "ai_extracted_text",
        "ai_suggested_title",
    ]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = [
        "id",
        "file_hash",
        "file_size",
        "content_type",
        "width",
        "height",
        "ai_generated_tags",
        "ai_suggested_title",
        "ai_extracted_text",
        "ai_confidence_score",
        "download_count",
        "last_accessed",
        "created_at",
        "updated_at",
        "created_by",
    ]
    filter_horizontal = ["tags", "collections"]
    inlines = [MediaUsageInline]

    fieldsets = (
        (
            None,
            {"fields": ("title", "slug", "description", "namespace", "access_level")},
        ),
        (
            "File Information",
            {
                "fields": (
                    "original_filename",
                    "file_path",
                    "file_hash",
                    "file_size",
                    "content_type",
                    "file_type",
                ),
                "classes": ("collapse",),
            },
        ),
        ("Media Properties", {"fields": ("width", "height"), "classes": ("collapse",)}),
        (
            "AI Analysis",
            {
                "fields": (
                    "ai_generated_tags",
                    "ai_suggested_title",
                    "ai_extracted_text",
                    "ai_confidence_score",
                ),
                "classes": ("collapse",),
            },
        ),
        ("Organization", {"fields": ("tags", "collections")}),
        (
            "Usage Statistics",
            {"fields": ("download_count", "last_accessed"), "classes": ("collapse",)},
        ),
        (
            "Metadata",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                    "created_by",
                    "last_modified_by",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def file_size_display(self, obj):
        """Display human-readable file size."""
        return obj.file_size_human

    file_size_display.short_description = "Size"

    def dimensions_display(self, obj):
        """Display image dimensions."""
        return obj.dimensions or "-"

    dimensions_display.short_description = "Dimensions"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return (
            super()
            .get_queryset(request)
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags", "collections")
        )

    def save_model(self, request, obj, form, change):
        """Set created_by and last_modified_by when saving."""
        if not change:
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(MediaCollection)
class MediaCollectionAdmin(admin.ModelAdmin):
    """Admin interface for media collections."""

    list_display = [
        "title",
        "slug",
        "namespace",
        "access_level",
        "file_count",
        "created_at",
        "created_by",
    ]
    list_filter = ["namespace", "access_level", "created_at", "created_by", "tags"]
    search_fields = ["title", "slug", "description"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ["created_at", "updated_at", "created_by"]
    filter_horizontal = ["tags"]

    fieldsets = (
        (
            None,
            {"fields": ("title", "slug", "description", "namespace", "access_level")},
        ),
        ("Organization", {"fields": ("tags",)}),
        (
            "Metadata",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                    "created_by",
                    "last_modified_by",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def file_count(self, obj):
        """Display number of files in collection."""
        count = obj.mediafile_set.count()
        if count > 0:
            url = reverse("admin:file_manager_mediafile_changelist")
            return format_html(
                '<a href="{}?collections__id__exact={}">{} files</a>',
                url,
                obj.id,
                count,
            )
        return "0 files"

    file_count.short_description = "Files"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return (
            super()
            .get_queryset(request)
            .select_related("namespace", "created_by", "last_modified_by")
            .prefetch_related("tags")
        )

    def save_model(self, request, obj, form, change):
        """Set created_by and last_modified_by when saving."""
        if not change:
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(MediaUsage)
class MediaUsageAdmin(admin.ModelAdmin):
    """Admin interface for media usage tracking."""

    list_display = [
        "media_file",
        "usage_type",
        "object_type",
        "object_id",
        "field_name",
        "created_at",
        "created_by",
    ]
    list_filter = ["usage_type", "object_type", "created_at", "created_by"]
    search_fields = ["media_file__title", "object_id", "object_type", "field_name"]
    readonly_fields = [
        "media_file",
        "usage_type",
        "object_id",
        "object_type",
        "field_name",
        "context_data",
        "created_at",
        "created_by",
    ]

    def has_add_permission(self, request):
        """Usage records are auto-generated."""
        return False

    def has_change_permission(self, request, obj=None):
        """Usage records are read-only."""
        return False


@admin.register(PendingMediaFile)
class PendingMediaFileAdmin(admin.ModelAdmin):
    """Admin interface for pending media files."""

    list_display = [
        "original_filename",
        "file_type",
        "file_size_display",
        "status",
        "namespace",
        "uploaded_by",
        "created_at",
        "expires_at",
    ]
    list_filter = [
        "status",
        "file_type",
        "namespace",
        "uploaded_by",
        "created_at",
        "expires_at",
    ]
    search_fields = [
        "original_filename",
        "ai_suggested_title",
        "ai_extracted_text",
    ]
    readonly_fields = [
        "id",
        "file_hash",
        "file_size",
        "content_type",
        "width",
        "height",
        "ai_generated_tags",
        "ai_suggested_title",
        "ai_extracted_text",
        "ai_confidence_score",
        "created_at",
        "uploaded_by",
    ]

    fieldsets = (
        (
            None,
            {"fields": ("original_filename", "status", "namespace", "folder_path")},
        ),
        (
            "File Information",
            {
                "fields": (
                    "file_path",
                    "file_hash",
                    "file_size",
                    "content_type",
                    "file_type",
                ),
                "classes": ("collapse",),
            },
        ),
        ("Media Properties", {"fields": ("width", "height"), "classes": ("collapse",)}),
        (
            "AI Analysis",
            {
                "fields": (
                    "ai_generated_tags",
                    "ai_suggested_title",
                    "ai_extracted_text",
                    "ai_confidence_score",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {
                "fields": (
                    "created_at",
                    "expires_at",
                    "uploaded_by",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["approve_files", "reject_files"]

    def file_size_display(self, obj):
        """Display human-readable file size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if obj.file_size < 1024.0:
                return f"{obj.file_size:.1f} {unit}"
            obj.file_size /= 1024.0
        return f"{obj.file_size:.1f} PB"

    file_size_display.short_description = "Size"

    def approve_files(self, request, queryset):
        """Approve selected pending files."""
        approved_count = 0
        for pending_file in queryset.filter(status="pending"):
            try:
                # Use AI suggested title or filename as fallback
                title = (
                    pending_file.ai_suggested_title or pending_file.original_filename
                )
                pending_file.approve_and_create_media_file(title=title)
                approved_count += 1
            except Exception as e:
                self.message_user(
                    request,
                    f"Failed to approve {pending_file.original_filename}: {e}",
                    level="ERROR",
                )

        if approved_count > 0:
            self.message_user(
                request,
                f"Successfully approved {approved_count} files.",
                level="SUCCESS",
            )

    approve_files.short_description = "Approve selected pending files"

    def reject_files(self, request, queryset):
        """Reject selected pending files."""
        rejected_count = 0
        for pending_file in queryset.filter(status="pending"):
            try:
                pending_file.reject()
                rejected_count += 1
            except Exception as e:
                self.message_user(
                    request,
                    f"Failed to reject {pending_file.original_filename}: {e}",
                    level="ERROR",
                )

        if rejected_count > 0:
            self.message_user(
                request,
                f"Successfully rejected {rejected_count} files.",
                level="SUCCESS",
            )

    reject_files.short_description = "Reject selected pending files"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related("namespace", "uploaded_by")
