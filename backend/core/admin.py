"""
Admin interface for core models.
"""

from django.contrib import admin
from .models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    """Admin interface for Tenant model."""

    list_display = ["name", "identifier", "is_active", "created_at", "created_by"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "identifier"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "name",
                    "identifier",
                    "is_active",
                )
            },
        ),
        (
            "Settings",
            {
                "fields": ("settings",),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                    "created_by",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by on creation."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
