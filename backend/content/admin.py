"""
Django Admin configuration for Content Object Publishing System

Provides admin interface for content objects that can be published as pages.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Namespace, Category, Tag


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

    list_display = [
        "name",
        "slug",
        "namespace",
        "usage_count",
        "content_usage",
        "created_at",
    ]
    list_filter = ["namespace", "created_at"]
    search_fields = ["name", "slug"]
    ordering = ["namespace", "-usage_count", "name"]

    fieldsets = (
        ("Basic Information", {"fields": ("name", "slug", "namespace")}),
        ("Usage Statistics", {"fields": ("usage_count",), "classes": ("collapse",)}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    readonly_fields = ["usage_count", "created_at"]

    actions = ["reset_usage_count"]

    def content_usage(self, obj):
        """Show how many content objects use this tag"""
        members_count = obj.members.count()
        total = members_count

        if total > 0:
            details = []
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
