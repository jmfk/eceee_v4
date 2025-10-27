"""Content Import app configuration."""

from django.apps import AppConfig


class ContentImportConfig(AppConfig):
    """Configuration for Content Import app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "content_import"
    verbose_name = "Content Import"
