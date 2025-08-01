"""
Django Admin interface for Web Page Publishing System

Provides comprehensive admin interface for managing pages, layouts, themes,
widget types, and versions through the Django admin panel.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import WebPage, PageVersion, PageTheme
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
        ("Basic Information", {"fields": ("name", "description", "is_active")}),
        ("Theme Configuration", {"fields": ("css_variables", "custom_css")}),
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
        "created_at",
        "created_by",
        "admin_link",
        "publication_status_display",
    ]
    fields = [
        "version_number",
        "description",
        "effective_date",
        "expiry_date",
        "publication_status_display",
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
        "theme",
        "parent",
        ("parent", admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = ["title", "slug", "description", "meta_title"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = [
        "created_at",
        "updated_at",
        "get_absolute_url",
        "get_breadcrumbs_display",
        "get_hostnames_display",
        "is_root_page_display",
    ]

    inlines = [PageVersionInline]

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("title", "slug", "description", "parent", "sort_order")},
        ),
        (
            "Multi-Site Configuration",
            {
                "fields": (
                    "hostnames",
                    "is_root_page_display",
                    "get_hostnames_display",
                ),
                "description": "Hostname configuration (only available for root pages without parent)",
                "classes": ("wide",),
            },
        ),
        (
            "Layout & Theme",
            {
                "fields": ("code_layout", "theme"),
                "description": "Specify code layout name or leave blank to inherit from parent page",
            },
        ),
        (
            "Publishing",
            {
                "fields": ("publication_status", "effective_date", "expiry_date"),
                "classes": ("wide",),
            },
        ),
        (
            "SEO & Metadata",
            {
                "fields": ("meta_title", "meta_description", "meta_keywords"),
                "classes": ("collapse",),
            },
        ),
        (
            "Object Publishing",
            {
                "fields": ("linked_object_type", "linked_object_id"),
                "classes": ("collapse",),
                "description": "For pages that display content from other objects",
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
                return format_html('<span style="color: green;">✓ Published (v{})</span>', current_version.version_number)
            elif status == "scheduled":
                return format_html('<span style="color: orange;">⏰ Scheduled (v{})</span>', current_version.version_number)
            elif status == "expired":
                return format_html('<span style="color: red;">❌ Expired (v{})</span>', current_version.version_number)
        
        # Check if there are any versions with future effective dates
        from django.utils import timezone
        now = timezone.now()
        future_versions = obj.versions.filter(effective_date__gt=now).order_by('effective_date').first()
        if future_versions:
            return format_html('<span style="color: orange;">⏰ Scheduled (v{})</span>', future_versions.version_number)
        
        return format_html('<span style="color: gray;">No published version</span>')

    current_version_status_display.short_description = "Current Version"

    def get_hostnames_display(self, obj):
        """Display hostnames with styling"""
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

    def get_breadcrumbs_display(self, obj):
        """Display page breadcrumbs"""
        breadcrumbs = obj.get_breadcrumbs()
        if len(breadcrumbs) <= 1:
            return "Root page"

        links = []
        for page in breadcrumbs[:-1]:  # Exclude current page
            url = reverse("admin:webpages_webpage_change", args=[page.pk])
            links.append(f'<a href="{url}">{page.title}</a>')

        return mark_safe(" → ".join(links) + f" → <strong>{obj.title}</strong>")

    get_breadcrumbs_display.short_description = "Breadcrumbs"

    def save_model(self, request, obj, form, change):
        """Handle user assignment and version creation"""
        if not change:  # Creating new object
            obj.created_by = request.user
        obj.last_modified_by = request.user

        super().save_model(request, obj, form, change)

        # Create version if this is a significant change
        if change and any(
            field in form.changed_data
            for field in [
                "title",
                "description",
                "code_layout",
                "theme",
                "publication_status",
                "hostnames",
            ]
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
                            f"Page '{page.title}' has no published version - skipped"
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
                            description=f"Admin compaction: deleted {deleted_count} old versions",
                            status="published",
                            auto_publish=True,
                        )

            except Exception as e:
                errors.append(f"Error compacting '{page.title}': {str(e)}")

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
        "page",
        "version_number",
        "description",
        "publication_status_display",
        "effective_date",
        "created_at",
        "created_by",
        "page_admin_link",
    ]
    list_filter = ["effective_date", "expiry_date", "created_at", "page"]
    search_fields = ["page__title", "description"]
    readonly_fields = ["created_at", "version_number", "page_admin_link"]

    fieldsets = (
        (
            "Version Information",
            {"fields": ("page", "version_number", "page_admin_link")},
        ),
        (
            "Publishing",
            {"fields": ("effective_date", "expiry_date")},
        ),
        (
            "Content",
            {
                "fields": ("description", "page_data", "widgets"),
                "description": "JSON fields can be edited manually. Ensure valid JSON format.",
            },
        ),
        (
            "Metadata",
            {"fields": ("created_at", "created_by"), "classes": ("collapse",)},
        ),
    )

    def get_form(self, request, obj=None, **kwargs):
        """Customize form to use textarea widgets for JSON fields"""
        form = super().get_form(request, obj, **kwargs)

        # Use textarea widgets for JSON fields to make editing easier
        if "page_data" in form.base_fields:
            form.base_fields["page_data"].widget = admin.widgets.AdminTextareaWidget(
                attrs={"rows": 20, "cols": 80, "style": "font-family: monospace;"}
            )
        if "widgets" in form.base_fields:
            form.base_fields["widgets"].widget = admin.widgets.AdminTextareaWidget(
                attrs={"rows": 15, "cols": 80, "style": "font-family: monospace;"}
            )

        return form

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
            return format_html(
                '<a href="{}" target="_blank">View Page: {}</a>', url, obj.page.title
            )
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
        
        return format_html('<span style="color: {};">{} {}</span>', color, icon, status.title())

    publication_status_display.short_description = "Publication Status"

    actions = ["restore_version"]

    def restore_version(self, request, queryset):
        """Admin action to restore selected versions"""
        for version in queryset:
            version.restore(request.user)
        self.message_user(request, f"Restored {queryset.count()} version(s)")

    restore_version.short_description = "Restore selected versions"


# Customize admin site headers
admin.site.site_header = "ECEEE v4 Web Publishing System"
admin.site.site_title = "ECEEE v4 Admin"
admin.site.index_title = "Web Publishing Administration"
