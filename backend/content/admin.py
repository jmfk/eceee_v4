"""
Django Admin configuration for Content Object Publishing System

Provides admin interface for content objects that can be published as pages.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Namespace, Category, Tag, News, Event, LibraryItem, Member


@admin.register(Namespace)
class NamespaceAdmin(admin.ModelAdmin):
    """Admin configuration for Namespace model"""

    list_display = [
        "name",
        "slug",
        "is_active",
        "is_default",
        "content_count",
        "created_at",
    ]
    list_filter = ["is_active", "is_default", "created_at"]
    search_fields = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}
    ordering = ["name"]
    readonly_fields = ["content_count"]

    fieldsets = (
        ("Basic Information", {"fields": ("name", "slug", "description")}),
        ("Configuration", {"fields": ("is_active", "is_default")}),
        ("Statistics", {"fields": ("content_count",), "classes": ("collapse",)}),
    )

    def content_count(self, obj):
        """Display total content count for this namespace"""
        return obj.get_content_count()

    content_count.short_description = "Content Objects"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Admin configuration for Category model"""

    list_display = [
        "name",
        "slug",
        "namespace",
        "color_badge",
        "is_active",
        "created_at",
    ]
    list_filter = ["is_active", "namespace", "created_at"]
    search_fields = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}
    ordering = ["namespace", "name"]

    def color_badge(self, obj):
        """Display color as a badge"""
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            obj.color,
            obj.color,
        )

    color_badge.short_description = "Color"


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin configuration for Tag model"""

    list_display = ["name", "namespace", "usage_count", "content_usage", "created_at"]
    list_filter = ["namespace", "created_at"]
    search_fields = ["name"]
    ordering = ["namespace", "-usage_count", "name"]

    fieldsets = (
        ("Basic Information", {"fields": ("name", "namespace")}),
        ("Usage Statistics", {"fields": ("usage_count",), "classes": ("collapse",)}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    readonly_fields = ["usage_count", "created_at"]

    actions = ["reset_usage_count"]

    def content_usage(self, obj):
        """Show how many content objects use this tag"""
        news_count = obj.news_articles.count()
        events_count = obj.events.count()
        library_count = obj.library_items.count()
        members_count = obj.members.count()
        total = news_count + events_count + library_count + members_count

        if total > 0:
            details = []
            if news_count > 0:
                details.append(f"{news_count} news")
            if events_count > 0:
                details.append(f"{events_count} events")
            if library_count > 0:
                details.append(f"{library_count} library")
            if members_count > 0:
                details.append(f"{members_count} members")

            return format_html(
                '<span title="{}">{} objects</span>', ", ".join(details), total
            )
        return "0 objects"

    content_usage.short_description = "Content Usage"

    # Admin actions
    def reset_usage_count(self, request, queryset):
        """Reset usage count for selected tags"""
        updated = queryset.update(usage_count=0)
        self.message_user(request, f"Usage count reset for {updated} tag(s).")

    reset_usage_count.short_description = "Reset usage count"


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    """Admin configuration for News model"""

    list_display = [
        "title",
        "namespace",
        "author",
        "category",
        "priority",
        "is_published",
        "published_date",
        "featured",
        "created_at",
    ]
    list_filter = [
        "is_published",
        "featured",
        "priority",
        "namespace",
        "category",
        "published_date",
        "created_at",
    ]
    search_fields = ["title", "description", "content", "author"]
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ["tags"]
    date_hierarchy = "published_date"
    ordering = ["-priority", "-published_date", "-created_at"]

    fieldsets = (
        ("Basic Information", {"fields": ("title", "slug", "description", "excerpt")}),
        ("Content", {"fields": ("content", "featured_image", "gallery_images")}),
        ("Publication", {"fields": ("is_published", "published_date", "featured")}),
        ("Categorization", {"fields": ("category", "tags")}),
        (
            "News Metadata",
            {"fields": ("author", "byline", "source", "source_url", "priority")},
        ),
        (
            "Display Options",
            {"fields": ("show_author", "show_publish_date", "allow_comments")},
        ),
        (
            "SEO",
            {
                "fields": ("meta_title", "meta_description", "meta_keywords"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["publish_selected", "unpublish_selected", "feature_selected"]

    def publish_selected(self, request, queryset):
        """Publish selected news articles"""
        for news in queryset:
            news.publish(user=request.user)
        self.message_user(request, f"{queryset.count()} news articles published.")

    publish_selected.short_description = "Publish selected news articles"

    def unpublish_selected(self, request, queryset):
        """Unpublish selected news articles"""
        for news in queryset:
            news.unpublish(user=request.user)
        self.message_user(request, f"{queryset.count()} news articles unpublished.")

    unpublish_selected.short_description = "Unpublish selected news articles"

    def feature_selected(self, request, queryset):
        """Feature selected news articles"""
        queryset.update(featured=True)
        self.message_user(request, f"{queryset.count()} news articles featured.")

    feature_selected.short_description = "Feature selected news articles"

    def save_model(self, request, obj, form, change):
        if not change:  # Creating new object
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """Admin configuration for Event model"""

    list_display = [
        "title",
        "namespace",
        "start_date",
        "location_name",
        "status",
        "is_published",
        "featured",
        "organizer_name",
    ]
    list_filter = [
        "is_published",
        "featured",
        "status",
        "namespace",
        "category",
        "start_date",
        "created_at",
    ]
    search_fields = [
        "title",
        "description",
        "content",
        "location_name",
        "organizer_name",
    ]
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ["tags"]
    date_hierarchy = "start_date"
    ordering = ["start_date", "title"]

    fieldsets = (
        ("Basic Information", {"fields": ("title", "slug", "description", "excerpt")}),
        ("Content", {"fields": ("content", "featured_image", "gallery_images")}),
        ("Event Timing", {"fields": ("start_date", "end_date", "all_day", "timezone")}),
        (
            "Location",
            {
                "fields": (
                    "location_name",
                    "location_address",
                    "location_url",
                    "virtual_meeting_url",
                )
            },
        ),
        (
            "Registration",
            {
                "fields": (
                    "registration_required",
                    "registration_url",
                    "max_attendees",
                    "current_attendees",
                )
            },
        ),
        (
            "Organizer",
            {"fields": ("organizer_name", "organizer_email", "organizer_phone")},
        ),
        (
            "Publication",
            {"fields": ("is_published", "published_date", "featured", "status")},
        ),
        ("Categorization", {"fields": ("category", "tags")}),
        ("Display Options", {"fields": ("show_location", "show_organizer")}),
        (
            "SEO",
            {
                "fields": ("meta_title", "meta_description", "meta_keywords"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["publish_selected", "unpublish_selected", "feature_selected"]

    def publish_selected(self, request, queryset):
        for event in queryset:
            event.publish(user=request.user)
        self.message_user(request, f"{queryset.count()} events published.")

    publish_selected.short_description = "Publish selected events"

    def unpublish_selected(self, request, queryset):
        for event in queryset:
            event.unpublish(user=request.user)
        self.message_user(request, f"{queryset.count()} events unpublished.")

    unpublish_selected.short_description = "Unpublish selected events"

    def feature_selected(self, request, queryset):
        queryset.update(featured=True)
        self.message_user(request, f"{queryset.count()} events featured.")

    feature_selected.short_description = "Feature selected events"

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(LibraryItem)
class LibraryItemAdmin(admin.ModelAdmin):
    """Admin configuration for LibraryItem model"""

    list_display = [
        "title",
        "namespace",
        "item_type",
        "file_format",
        "access_level",
        "is_published",
        "featured",
        "download_count",
        "view_count",
    ]
    list_filter = [
        "is_published",
        "featured",
        "item_type",
        "access_level",
        "namespace",
        "category",
        "created_at",
    ]
    search_fields = ["title", "description", "content"]
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ["tags"]
    ordering = ["-featured", "-published_date", "title"]
    readonly_fields = ["download_count", "view_count"]

    fieldsets = (
        ("Basic Information", {"fields": ("title", "slug", "description", "excerpt")}),
        ("Content", {"fields": ("content", "featured_image", "gallery_images")}),
        (
            "File Information",
            {
                "fields": (
                    "item_type",
                    "file_url",
                    "file_size",
                    "file_format",
                    "attachments",
                )
            },
        ),
        ("Access Control", {"fields": ("access_level", "version")}),
        ("Publication", {"fields": ("is_published", "published_date", "featured")}),
        ("Categorization", {"fields": ("category", "tags")}),
        ("Academic Metadata", {"fields": ("isbn", "doi"), "classes": ("collapse",)}),
        (
            "Usage Statistics",
            {"fields": ("download_count", "view_count"), "classes": ("collapse",)},
        ),
        (
            "SEO",
            {
                "fields": ("meta_title", "meta_description", "meta_keywords"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["publish_selected", "unpublish_selected", "feature_selected"]

    def publish_selected(self, request, queryset):
        for item in queryset:
            item.publish(user=request.user)
        self.message_user(request, f"{queryset.count()} library items published.")

    publish_selected.short_description = "Publish selected library items"

    def unpublish_selected(self, request, queryset):
        for item in queryset:
            item.unpublish(user=request.user)
        self.message_user(request, f"{queryset.count()} library items unpublished.")

    unpublish_selected.short_description = "Unpublish selected library items"

    def feature_selected(self, request, queryset):
        queryset.update(featured=True)
        self.message_user(request, f"{queryset.count()} library items featured.")

    feature_selected.short_description = "Feature selected library items"

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    """Admin configuration for Member model"""

    list_display = [
        "get_full_name",
        "namespace",
        "job_title",
        "department",
        "member_type",
        "is_current",
        "is_published",
        "featured",
    ]
    list_filter = [
        "is_published",
        "featured",
        "member_type",
        "is_current",
        "namespace",
        "category",
        "created_at",
    ]
    search_fields = [
        "first_name",
        "last_name",
        "display_name",
        "job_title",
        "department",
        "organization",
        "biography",
    ]
    prepopulated_fields = {"slug": ("first_name", "last_name")}
    filter_horizontal = ["tags"]
    ordering = ["last_name", "first_name"]

    fieldsets = (
        ("Basic Information", {"fields": ("title", "slug", "description", "excerpt")}),
        (
            "Personal Information",
            {"fields": ("first_name", "last_name", "middle_name", "display_name")},
        ),
        (
            "Professional Information",
            {"fields": ("job_title", "department", "organization")},
        ),
        ("Contact Information", {"fields": ("email", "phone", "office_location")}),
        (
            "Professional Details",
            {"fields": ("biography", "expertise_areas", "qualifications")},
        ),
        ("Web Presence", {"fields": ("website_url", "linkedin_url", "twitter_handle")}),
        (
            "Membership",
            {"fields": ("member_type", "start_date", "end_date", "is_current")},
        ),
        ("Media", {"fields": ("featured_image", "gallery_images")}),
        ("Publication", {"fields": ("is_published", "published_date", "featured")}),
        ("Categorization", {"fields": ("category", "tags")}),
        (
            "Display Options",
            {"fields": ("show_contact_info", "show_biography", "list_in_directory")},
        ),
        (
            "SEO",
            {
                "fields": ("meta_title", "meta_description", "meta_keywords"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = [
        "publish_selected",
        "unpublish_selected",
        "feature_selected",
        "mark_current",
    ]

    def publish_selected(self, request, queryset):
        for member in queryset:
            member.publish(user=request.user)
        self.message_user(request, f"{queryset.count()} member profiles published.")

    publish_selected.short_description = "Publish selected member profiles"

    def unpublish_selected(self, request, queryset):
        for member in queryset:
            member.unpublish(user=request.user)
        self.message_user(request, f"{queryset.count()} member profiles unpublished.")

    unpublish_selected.short_description = "Unpublish selected member profiles"

    def feature_selected(self, request, queryset):
        queryset.update(featured=True)
        self.message_user(request, f"{queryset.count()} member profiles featured.")

    feature_selected.short_description = "Feature selected member profiles"

    def mark_current(self, request, queryset):
        queryset.update(is_current=True)
        self.message_user(request, f"{queryset.count()} members marked as current.")

    mark_current.short_description = "Mark selected members as current"

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)
