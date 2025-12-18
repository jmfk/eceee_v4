from django.contrib import admin
from .models import Form, FormSubmission, FormFieldType

@admin.register(FormFieldType)
class FormFieldTypeAdmin(admin.ModelAdmin):
    list_display = ("label", "name", "base_type", "is_custom", "is_active", "tenant")
    list_filter = ("base_type", "is_custom", "is_active", "tenant")
    search_fields = ("label", "name", "description")
    prepopulated_fields = {"name": ("label",)}

@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ("label", "name", "version", "is_active", "tenant", "created_at")
    list_filter = ("is_active", "tenant", "created_at")
    search_fields = ("label", "name", "description")
    prepopulated_fields = {"name": ("label",)}

@admin.register(FormSubmission)
class FormSubmissionAdmin(admin.ModelAdmin):
    list_display = ("form", "status", "tenant", "created_at")
    list_filter = ("status", "tenant", "created_at", "form")
    readonly_fields = ("form", "data", "metadata", "created_at")

