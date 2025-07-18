"""
Django Admin interface for Web Page Publishing System

Provides comprehensive admin interface for managing pages, layouts, themes,
widget types, and versions through the Django admin panel.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import WebPage, PageVersion, PageLayout, PageTheme, WidgetType


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


@admin.register(PageLayout)
class PageLayoutAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "is_active", "created_at", "created_by"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Basic Information", {"fields": ("name", "description", "is_active")}),
        ("Layout Configuration", {"fields": ("slot_configuration", "css_classes")}),
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


@admin.register(WidgetType)
class WidgetTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "template_name", "is_active", "created_at"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "description", "template_name"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Basic Information", {"fields": ("name", "description", "is_active")}),
        ("Widget Configuration", {"fields": ("json_schema", "template_name")}),
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
    readonly_fields = ["version_number", "created_at", "created_by", "is_current"]
    fields = ["version_number", "description", "is_current", "created_at", "created_by"]

    def has_add_permission(self, request, obj=None):
        return False  # Versions are created automatically


@admin.register(WebPage)
class WebPageAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "slug",
        "parent",
        "get_hostnames_display",
        "publication_status",
        "effective_date",
        "is_published_display",
        "sort_order",
        "created_at",
    ]
    list_filter = [
        "publication_status",
        HasHostnamesFilter,
        "created_at",
        "updated_at",
        "layout",
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
                "fields": ("layout", "theme"),
                "description": "Leave blank to inherit from parent page",
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
        """Display publication status with color coding"""
        if obj.is_published():
            return format_html('<span style="color: green;">✓ Published</span>')
        elif obj.publication_status == "scheduled":
            return format_html('<span style="color: orange;">⏰ Scheduled</span>')
        elif obj.publication_status == "expired":
            return format_html('<span style="color: red;">❌ Expired</span>')
        else:
            return format_html('<span style="color: gray;">⏸ Unpublished</span>')

    is_published_display.short_description = "Status"

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
                "layout",
                "theme",
                "publication_status",
                "hostnames",
            ]
        ):
            obj.create_version(request.user, "Admin update")

    actions = ["clear_hostnames", "show_hostname_summary"]

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


@admin.register(PageVersion)
class PageVersionAdmin(admin.ModelAdmin):
    list_display = [
        "page",
        "version_number",
        "description",
        "is_current",
        "created_at",
        "created_by",
    ]
    list_filter = ["is_current", "created_at", "page"]
    search_fields = ["page__title", "description"]
    readonly_fields = ["created_at", "version_number", "page_data"]

    fieldsets = (
        ("Version Information", {"fields": ("page", "version_number", "is_current")}),
        ("Content", {"fields": ("description", "page_data"), "classes": ("collapse",)}),
        (
            "Metadata",
            {"fields": ("created_at", "created_by"), "classes": ("collapse",)},
        ),
    )

    def has_add_permission(self, request):
        return False  # Versions are created automatically

    def has_change_permission(self, request, obj=None):
        return False  # Versions should not be manually edited

    actions = ["restore_version"]

    def restore_version(self, request, queryset):
        """Admin action to restore selected versions"""
        for version in queryset:
            version.restore(request.user)
        self.message_user(request, f"Restored {queryset.count()} version(s)")

    restore_version.short_description = "Restore selected versions"


# Removed PageWidgetAdmin - widgets are now stored in PageVersion JSON data
# @admin.register(PageWidget)
# class PageWidgetAdmin(admin.ModelAdmin):
#     list_display = [
#         "page",
#         "widget_type",
#         "slot_name",
#         "sort_order",
#         "inherit_from_parent",
#         "override_parent",
#         "created_at",
#     ]
#     list_filter = [
#         "widget_type",
#         "slot_name",
#         "inherit_from_parent",
#         "override_parent",
#         "created_at",
#     ]
#     search_fields = ["page__title", "widget_type__name", "slot_name"]
#     readonly_fields = ["created_at", "updated_at"]
#
#     fieldsets = (
#         (
#             "Basic Information",
#             {"fields": ("page", "widget_type", "slot_name", "sort_order")},
#         ),
#         ("Configuration", {"fields": ("configuration",)}),
#         (
#             "Inheritance",
#             {
#                 "fields": ("inherit_from_parent", "override_parent"),
#                 "description": "Control how this widget affects child pages",
#             },
#         ),
#         (
#             "Metadata",
#             {
#                 "fields": ("created_at", "updated_at", "created_by"),
#                 "classes": ("collapse",),
#             },
#         ),
#     )
#
#     def save_model(self, request, obj, form, change):
#         if not change:  # Creating new object
#             obj.created_by = request.user
#         super().save_model(request, obj, form, change)


# Customize admin site headers
admin.site.site_header = "ECEEE v4 Web Publishing System"
admin.site.site_title = "ECEEE v4 Admin"
admin.site.index_title = "Web Publishing Administration"
