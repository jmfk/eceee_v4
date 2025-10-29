"""
Django Admin interface for Web Page Publishing System

Provides comprehensive admin interface for managing pages, layouts, themes,
widget types, and versions through the Django admin panel.
"""

from django.contrib import admin
from django import forms
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import (
    WebPage,
    PageVersion,
    PageTheme,
    PageDataSchema,
    PreviewSize,
    DuplicatePageLog,
)
import json


class PrettyJSONWidget(admin.widgets.AdminTextareaWidget):
    """Textarea widget that renders JSON with 2-space indentation without escaped newlines."""

    def format_value(self, value):
        if value is None:
            return ""
        # If value is already a Python object, pretty-print it
        if isinstance(value, (dict, list)):
            try:
                return json.dumps(value, indent=2, ensure_ascii=False)
            except Exception:
                return str(value)
        # If value is a string containing JSON, normalize it to pretty JSON
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return json.dumps(parsed, indent=2, ensure_ascii=False)
            except Exception:
                # Not valid JSON; return as-is so user can correct it
                return value
        # Fallback
        return str(value)


from .middleware import HostnameUpdateMixin


class HasHostnamesFilter(admin.SimpleListFilter):
    title = "has hostnames"
    parameter_name = "has_hostnames"

    def lookups(self, request, model_admin):
        return (
            ("yes", "Has hostnames"),
            ("no", "No hostnames"),
            ("root", "Root pages only"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(hostnames=[])
        elif self.value() == "no":
            return queryset.filter(hostnames=[])
        elif self.value() == "root":
            return queryset.filter(parent__isnull=True)
        return queryset


# PageLayoutAdmin removed - now using code-based layouts only


@admin.register(PageTheme)
class PageThemeAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "is_active", "created_at", "created_by"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("name", "description", "image", "is_active", "is_default")},
        ),
        (
            "Theme Configuration",
            {
                "fields": (
                    "css_variables",
                    "html_elements",
                    "image_styles",
                    "custom_css",
                )
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
                "classes": ("collapse",),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


# WidgetType admin removed - widget types are now code-based


# Removed PageWidgetInline - widgets are now stored in PageVersion JSON data
# class PageWidgetInline(admin.TabularInline):
#     model = PageWidget
#     extra = 0
#     fields = [
#         "widget_type",
#         "slot_name",
#         "sort_order",
#         "inherit_from_parent",
#         "override_parent",
#     ]
#     readonly_fields = ["created_at", "updated_at"]


class PageVersionInline(admin.TabularInline):
    model = PageVersion
    extra = 0
    readonly_fields = [
        "version_number",
        "version_title",
        "admin_link",
    ]
    fields = [
        "version_number",
        "version_title",
        "admin_link",
    ]

    def has_add_permission(self, request, obj=None):
        return False  # Versions are created automatically

    def admin_link(self, obj):
        """Generate a link to the admin page for this version"""
        if obj.pk:
            from django.urls import reverse
            from django.utils.html import format_html

            url = reverse("admin:webpages_pageversion_change", args=[obj.pk])
            return format_html('<a href="{}" target="_blank">View Version</a>', url)
        return "-"

    admin_link.short_description = "Admin Link"

    def publication_status_display(self, obj):
        """Display publication status for inline"""
        if not obj.pk:
            return "-"
        status = obj.get_publication_status()
        if status == "published":
            return format_html('<span style="color: green;">✓ Published</span>')
        elif status == "scheduled":
            return format_html('<span style="color: orange;">⏰ Scheduled</span>')
        elif status == "expired":
            return format_html('<span style="color: red;">❌ Expired</span>')
        else:
            return format_html('<span style="color: gray;">📝 Draft</span>')

    publication_status_display.short_description = "Status"


@admin.register(WebPage)
class WebPageAdmin(HostnameUpdateMixin, admin.ModelAdmin):
    list_display = [
        "title",
        "slug",
        "parent",
        "get_hostnames_display",
        "is_published_display",
        "current_version_status_display",
        "version_count_display",
        "sort_order",
        "created_at",
    ]

    def get_queryset(self, request):
        """Optimize queryset by prefetching related data"""
        return super().get_queryset(request).prefetch_related("versions")

    list_filter = [
        HasHostnamesFilter,
        "created_at",
        "updated_at",
        "slug",
        "parent",
        ("parent", admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = ["slug"]
    # Note: title, description, and meta fields are now in PageVersion.page_data so can't be searched directly
    readonly_fields = [
        "created_at",
        "updated_at",
        "get_absolute_url",
        "get_breadcrumbs_display",
        "get_hostnames_display",
        "is_root_page_display",
        "get_all_active_hostnames_display",
    ]

    inlines = [PageVersionInline]

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "title",
                    "description",
                    "slug",
                    "hostnames",
                    "parent",
                    "sort_order",
                )
            },
        ),
        (
            "Multi-Site Configuration",
            {
                "fields": (
                    "is_root_page_display",
                    "get_hostnames_display",
                    "get_all_active_hostnames_display",
                ),
                "description": "Hostname configuration (only available for root pages without parent)",
                "classes": ("wide",),
            },
        ),
        (
            "System Information",
            {
                "fields": (
                    "get_absolute_url",
                    "get_breadcrumbs_display",
                    "created_at",
                    "updated_at",
                    "created_by",
                    "last_modified_by",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def get_title(self, obj):
        """Display page title"""
        version = obj.get_current_published_version() or obj.get_latest_version()
        return version.meta_title if version and version.meta_title else "No version"

    def is_published_display(self, obj):
        """Display publication status with color coding using date-based logic"""
        if obj.is_published():
            return format_html('<span style="color: green;">✓ Published</span>')
        else:
            return format_html('<span style="color: gray;">⏸ Not Published</span>')

    is_published_display.short_description = "Published"

    def current_version_status_display(self, obj):
        """Display current version status with detailed information"""
        current_version = obj.get_current_published_version()
        if current_version:
            status = current_version.get_publication_status()
            if status == "published":
                return format_html(
                    '<span style="color: green;">✓ Published (v{})</span>',
                    current_version.version_number,
                )
            elif status == "scheduled":
                return format_html(
                    '<span style="color: orange;">⏰ Scheduled (v{})</span>',
                    current_version.version_number,
                )
            elif status == "expired":
                return format_html(
                    '<span style="color: red;">❌ Expired (v{})</span>',
                    current_version.version_number,
                )

        # Check if there are any versions with future effective dates
        from django.utils import timezone

        now = timezone.now()
        future_versions = (
            obj.versions.filter(effective_date__gt=now)
            .order_by("effective_date")
            .first()
        )
        if future_versions:
            return format_html(
                '<span style="color: orange;">⏰ Scheduled (v{})</span>',
                future_versions.version_number,
            )

        return format_html('<span style="color: gray;">No published version</span>')

    current_version_status_display.short_description = "Current Version"

    def get_hostnames_display(self, obj):
        """Display hostnames with styling and validation warnings"""
        # Check for invalid configuration: non-root page with hostnames
        if not obj.is_root_page() and obj.hostnames:
            return format_html(
                '<span style="color: red; font-weight: bold;">⚠ ERROR: '
                "Child page has hostnames (only root pages can have hostnames)</span>"
            )

        if not obj.is_root_page():
            return format_html(
                '<span style="color: gray; font-style: italic;">Child page</span>'
            )

        if not obj.hostnames:
            return format_html('<span style="color: orange;">No hostnames</span>')

        if len(obj.hostnames) <= 3:
            hostnames_text = ", ".join(obj.hostnames)
        else:
            hostnames_text = (
                f"{', '.join(obj.hostnames[:3])}... (+{len(obj.hostnames) - 3} more)"
            )

        return format_html('<span style="color: green;">🌐 {}</span>', hostnames_text)

    get_hostnames_display.short_description = "Hostnames"

    def version_count_display(self, obj):
        """Display version count with styling based on count"""
        count = obj.versions.count()
        if count == 0:
            return format_html('<span style="color: gray;">No versions</span>')
        elif count == 1:
            return format_html('<span style="color: green;">1 version</span>')
        elif count <= 5:
            return format_html('<span style="color: orange;">{} versions</span>', count)
        else:
            return format_html(
                '<span style="color: red; font-weight: bold;">{} versions</span>', count
            )

    version_count_display.short_description = "Versions"

    def is_root_page_display(self, obj):
        """Display whether this is a root page"""
        if obj.is_root_page():
            return format_html('<span style="color: green;">✓ Root Page</span>')
        else:
            return format_html('<span style="color: gray;">Child Page</span>')

    is_root_page_display.short_description = "Page Type"

    def get_all_active_hostnames_display(self, obj):
        """Display all currently active hostnames across the system"""
        try:
            all_hostnames = WebPage.get_all_hostnames()
            if all_hostnames:
                hostnames_list = ", ".join(all_hostnames)
                return format_html(
                    '<div style="background: #f0f8ff; padding: 10px; border-radius: 4px;">'
                    "<strong>Currently Active Hostnames:</strong><br>{}<br>"
                    '<small style="color: #666;">These are recognized by the middleware</small>'
                    "</div>",
                    hostnames_list,
                )
            else:
                return format_html(
                    '<span style="color: orange;">No hostnames configured in any root page</span>'
                )
        except Exception as e:
            return format_html(
                '<span style="color: red;">Error loading hostnames: {}</span>', str(e)
            )

    get_all_active_hostnames_display.short_description = "System-wide Active Hostnames"

    def get_breadcrumbs_display(self, obj):
        """Display page breadcrumbs"""
        breadcrumbs = obj.get_breadcrumbs()
        if len(breadcrumbs) <= 1:
            return "Root page"

        links = []
        for page in breadcrumbs[:-1]:  # Exclude current page
            url = reverse("admin:webpages_webpage_change", args=[page.pk])
            links.append(f'<a href="{url}">{page.slug}</a>')

        return mark_safe(" → ".join(links) + f" → <strong>{obj.slug}</strong>")

    get_breadcrumbs_display.short_description = "Breadcrumbs"

    def save_model(self, request, obj, form, change):
        """Handle user assignment and version creation"""
        if not change:  # Creating new object
            obj.created_by = request.user
        obj.last_modified_by = request.user

        super().save_model(request, obj, form, change)

        # Create version if this is a significant change
        if change and any(
            field in form.changed_data for field in ["hostnames", "slug"]
        ):
            obj.create_version(request.user, "Admin update")

    actions = ["clear_hostnames", "show_hostname_summary", "compact_page_versions"]

    def clear_hostnames(self, request, queryset):
        """Clear hostnames from selected root pages"""
        root_pages = queryset.filter(parent__isnull=True)
        updated_count = 0
        for page in root_pages:
            if page.hostnames:
                page.hostnames = []
                page.save()
                updated_count += 1

        self.message_user(
            request,
            f"Cleared hostnames from {updated_count} root page(s). "
            f"Skipped {queryset.count() - updated_count} child pages.",
        )

    clear_hostnames.short_description = "Clear hostnames from selected root pages"

    def show_hostname_summary(self, request, queryset):
        """Show hostname summary for selected pages"""
        root_pages = queryset.filter(parent__isnull=True)
        all_hostnames = set()

        for page in root_pages:
            if page.hostnames:
                all_hostnames.update(page.hostnames)

        if all_hostnames:
            hostname_list = ", ".join(sorted(all_hostnames))
            message = f"Hostnames in selected pages: {hostname_list}"
        else:
            message = "No hostnames found in selected root pages."

        self.message_user(request, message)

    show_hostname_summary.short_description = "Show hostname summary"

    def compact_page_versions(self, request, queryset):
        """Compact page versions by keeping only the latest published version"""
        from django.db import transaction
        from django.http import HttpResponseRedirect
        from django.template.response import TemplateResponse
        from django.utils import timezone

        # Calculate what would be deleted (preview)
        preview_data = []
        total_versions_to_delete = 0

        for page in queryset:
            current_version = page.get_current_version()
            if current_version:
                old_versions_count = page.versions.exclude(
                    id=current_version.id
                ).count()
                if old_versions_count > 0:
                    preview_data.append(
                        {
                            "page": page,
                            "current_version": current_version,
                            "versions_to_delete": old_versions_count,
                            "total_versions": page.versions.count(),
                        }
                    )
                    total_versions_to_delete += old_versions_count

        # If no confirmation yet, show preview page
        if request.POST.get("confirm_compact") != "yes":
            context = {
                "title": "Confirm Page Version Compaction",
                "action_name": "compact_page_versions",
                "queryset": queryset,
                "preview_data": preview_data,
                "total_versions_to_delete": total_versions_to_delete,
                "opts": self.model._meta,
                "has_view_permission": self.has_view_permission(request),
            }
            return TemplateResponse(
                request, "admin/webpages/compact_versions_confirmation.html", context
            )

        # Perform the actual compaction
        total_deleted = 0
        pages_processed = 0
        errors = []

        for page in queryset:
            try:
                with transaction.atomic():
                    # Get the current published version
                    current_version = page.get_current_version()

                    if not current_version:
                        errors.append(
                            f"Page '{page.slug}' has no published version - skipped"
                        )
                        continue

                    # Get all versions except the current one
                    old_versions = page.versions.exclude(id=current_version.id)
                    deleted_count = old_versions.count()

                    if deleted_count > 0:
                        # Delete old versions
                        old_versions.delete()
                        total_deleted += deleted_count
                        pages_processed += 1

                        # Create a log entry for this compaction (widgets will be preserved automatically)
                        page.create_version(
                            user=request.user,
                            version_title=f"Admin compaction: deleted {deleted_count} old versions",
                        )

            except Exception as e:
                errors.append(f"Error compacting '{page.slug}': {str(e)}")

        # Generate success message
        if pages_processed > 0:
            message = f"Successfully compacted {pages_processed} page(s), deleted {total_deleted} old version(s)."
        else:
            message = "No versions were compacted."

        # Add error information if any
        if errors:
            message += f" Errors: {'; '.join(errors)}"

        # Show appropriate message type
        if errors and pages_processed == 0:
            self.message_user(request, message, level="ERROR")
        elif errors:
            self.message_user(request, message, level="WARNING")
        else:
            self.message_user(request, message, level="SUCCESS")

    compact_page_versions.short_description = "Compact page versions (keep only latest)"


@admin.register(PageVersion)
class PageVersionAdmin(admin.ModelAdmin):
    list_display = [
        "meta_title",
        "version_number",
        "version_title",
        "publication_status_display",
        "effective_date",
        "created_at",
        "created_by",
        "page_admin_link",
    ]
    list_filter = ["effective_date", "expiry_date", "created_at", "page"]
    search_fields = [
        "version_title",
    ]  # Can't search page title anymore since it's in page_data
    readonly_fields = ["created_at", "version_number", "page_admin_link"]

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # Use PrettyJSONWidget for JSON fields for better readability without escapes
        json_widget = PrettyJSONWidget(
            attrs={
                "rows": 20,
                "cols": 80,
                "style": "font-family: monospace; white-space: pre;",
            }
        )
        for field_name in [
            "page_data",
            "widgets",
            "change_summary",
            "page_css_variables",
        ]:
            if field_name in form.base_fields:
                form.base_fields[field_name].widget = json_widget
        return form

    fieldsets = (
        (
            "Version Information",
            {
                "fields": (
                    "page",
                    "meta_title",
                    "meta_description",
                    "code_layout",
                    "version_number",
                    "page_admin_link",
                )
            },
        ),
        (
            "Publishing",
            {"fields": ("effective_date", "expiry_date")},
        ),
        (
            "Content",
            {
                "fields": ("version_title", "page_data", "widgets"),
                "description": "JSON fields can be edited manually. Ensure valid JSON format.",
            },
        ),
        (
            "Metadata",
            {"fields": ("created_at", "created_by"), "classes": ("collapse",)},
        ),
    )

    def has_add_permission(self, request):
        return False  # Versions are created automatically

    def has_change_permission(self, request, obj=None):
        return True  # Allow editing for JSON field modifications

    def page_admin_link(self, obj):
        """Generate a link to the admin page for the parent page"""
        if obj.page:
            from django.urls import reverse
            from django.utils.html import format_html

            url = reverse("admin:webpages_webpage_change", args=[obj.page.pk])
            return format_html('<a href="{}" target="_blank">View Page</a>', url)
        return "-"

    page_admin_link.short_description = "Parent Page"

    def publication_status_display(self, obj):
        """Display publication status with color coding using date-based logic"""
        status = obj.get_publication_status()
        if status == "published":
            icon = "✓"
            color = "green"
        elif status == "scheduled":
            icon = "⏰"
            color = "orange"
        elif status == "expired":
            icon = "❌"
            color = "red"
        else:  # draft
            icon = "📝"
            color = "gray"

        return format_html(
            '<span style="color: {};">{} {}</span>', color, icon, status.title()
        )

    publication_status_display.short_description = "Publication Status"

    actions = ["restore_version"]

    def restore_version(self, request, queryset):
        """Admin action to restore selected versions"""
        for version in queryset:
            version.restore(request.user)
        self.message_user(request, f"Restored {queryset.count()} version(s)")

    restore_version.short_description = "Restore selected versions"

    def get_meta_title(self, obj):
        """Display page meta title"""
        return obj.meta_title or obj.page.slug or "No title"


# PageDataSchema Admin
@admin.register(PageDataSchema)
class PageDataSchemaAdmin(admin.ModelAdmin):
    list_display = [
        "display_name",
        "scope",
        "layout_name",
        "is_active",
        "updated_at",
        "created_by",
    ]
    list_filter = ["scope", "layout_name", "is_active", "updated_at", "created_by"]
    search_fields = ["name", "layout_name", "description"]
    readonly_fields = ["created_at", "updated_at", "created_by"]

    def get_form(self, request, obj=None, **kwargs):
        """Use a large monospace textarea for the JSON schema field with pretty JSON rendering."""
        form = super().get_form(request, obj, **kwargs)
        if "schema" in form.base_fields:
            form.base_fields["schema"].widget = PrettyJSONWidget(
                attrs={
                    "rows": 24,
                    "cols": 100,
                    "style": "font-family: monospace; white-space: pre;",
                }
            )
        return form

    fieldsets = (
        (
            "Identification",
            {
                "fields": (
                    "scope",
                    "layout_name",
                    "name",
                    "description",
                    "is_active",
                )
            },
        ),
        ("Schema", {"fields": ("schema",)}),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["activate_selected", "deactivate_selected"]

    def display_name(self, obj):
        if obj.scope == PageDataSchema.SCOPE_LAYOUT:
            return obj.name or f"{obj.layout_name} Schema"
        return "System Schema"

    display_name.short_description = "Name"

    def save_model(self, request, obj, form, change):
        """Ensure creator is set and enforce single active schema per scope/layout."""
        from django.db import transaction

        if not change:
            obj.created_by = request.user

        with transaction.atomic():
            if obj.is_active:
                if obj.scope == PageDataSchema.SCOPE_SYSTEM:
                    PageDataSchema.objects.filter(
                        scope=PageDataSchema.SCOPE_SYSTEM, is_active=True
                    ).exclude(pk=obj.pk).update(is_active=False)
                elif obj.scope == PageDataSchema.SCOPE_LAYOUT and obj.layout_name:
                    PageDataSchema.objects.filter(
                        scope=PageDataSchema.SCOPE_LAYOUT,
                        layout_name=obj.layout_name,
                        is_active=True,
                    ).exclude(pk=obj.pk).update(is_active=False)

            super().save_model(request, obj, form, change)

    def activate_selected(self, request, queryset):
        from django.db import transaction

        updated = 0
        with transaction.atomic():
            for schema in queryset:
                if schema.scope == PageDataSchema.SCOPE_SYSTEM:
                    PageDataSchema.objects.filter(
                        scope=PageDataSchema.SCOPE_SYSTEM, is_active=True
                    ).exclude(pk=schema.pk).update(is_active=False)
                elif schema.scope == PageDataSchema.SCOPE_LAYOUT and schema.layout_name:
                    PageDataSchema.objects.filter(
                        scope=PageDataSchema.SCOPE_LAYOUT,
                        layout_name=schema.layout_name,
                        is_active=True,
                    ).exclude(pk=schema.pk).update(is_active=False)
                schema.is_active = True
                schema.save(update_fields=["is_active", "updated_at"])
                updated += 1

        self.message_user(
            request,
            f"Activated {updated} schema(s). Conflicting active schemas were deactivated.",
        )

    activate_selected.short_description = "Activate selected (deactivate conflicting)"

    def deactivate_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"Deactivated {updated} schema(s)")

    deactivate_selected.short_description = "Deactivate selected"


@admin.register(PreviewSize)
class PreviewSizeAdmin(admin.ModelAdmin):
    """Admin interface for preview size configurations"""

    list_display = [
        "name",
        "width",
        "height",
        "sort_order",
        "is_default",
        "created_at",
    ]
    list_editable = ["sort_order"]
    list_filter = ["is_default"]
    search_fields = ["name"]
    ordering = ["sort_order", "id"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = [
        (
            "Preview Size Information",
            {
                "fields": [
                    "name",
                    "width",
                    "height",
                ]
            },
        ),
        (
            "Display Options",
            {
                "fields": [
                    "sort_order",
                    "is_default",
                ]
            },
        ),
        (
            "Metadata",
            {
                "fields": ["created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]


@admin.register(DuplicatePageLog)
class DuplicatePageLogAdmin(admin.ModelAdmin):
    """Admin interface for duplicate page logs"""

    list_display = [
        "slug",
        "parent_link",
        "duplicate_count",
        "occurrence_count",
        "last_seen",
        "resolved",
        "email_sent",
    ]
    list_filter = ["resolved", "last_seen", "email_sent"]
    search_fields = ["slug", "parent__title"]
    readonly_fields = ["first_seen", "last_seen", "page_ids_display"]
    ordering = ["-last_seen"]
    date_hierarchy = "last_seen"

    fieldsets = [
        (
            "Duplicate Information",
            {
                "fields": [
                    "slug",
                    "parent",
                    "page_ids_display",
                ]
            },
        ),
        (
            "Statistics",
            {
                "fields": [
                    "occurrence_count",
                    "first_seen",
                    "last_seen",
                ]
            },
        ),
        (
            "Status",
            {
                "fields": [
                    "resolved",
                    "email_sent",
                    "notes",
                ]
            },
        ),
    ]

    actions = ["mark_as_resolved", "mark_as_unresolved"]

    @admin.display(description="Parent")
    def parent_link(self, obj):
        """Display parent page as a link"""
        if obj.parent:
            url = reverse("admin:webpages_webpage_change", args=[obj.parent.id])
            return format_html('<a href="{}">{}</a>', url, obj.parent.title)
        return "Root Level"

    @admin.display(description="Duplicates")
    def duplicate_count(self, obj):
        """Display number of duplicate pages"""
        if obj.page_ids:
            return len(obj.page_ids)
        return 0

    @admin.display(description="Page IDs")
    def page_ids_display(self, obj):
        """Display page IDs as links"""
        if not obj.page_ids:
            return "None"

        links = []
        for page_id in obj.page_ids:
            url = reverse("admin:webpages_webpage_change", args=[page_id])
            links.append(
                format_html('<a href="{}" target="_blank">ID {}</a>', url, page_id)
            )

        return format_html(", ".join(links))

    @admin.action(description="Mark selected as resolved")
    def mark_as_resolved(self, request, queryset):
        """Mark selected duplicates as resolved"""
        count = queryset.update(resolved=True)
        self.message_user(request, f"{count} duplicate(s) marked as resolved")

    @admin.action(description="Mark selected as unresolved")
    def mark_as_unresolved(self, request, queryset):
        """Mark selected duplicates as unresolved"""
        count = queryset.update(resolved=False)
        self.message_user(request, f"{count} duplicate(s) marked as unresolved")


# Customize admin site headers
admin.site.site_header = "ECEEE v4 Web Publishing System"
admin.site.site_title = "ECEEE v4 Admin"
admin.site.index_title = "Web Publishing Administration"
