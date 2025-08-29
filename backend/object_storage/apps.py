"""
Object Storage App Configuration
"""

from django.apps import AppConfig


class ObjectStorageConfig(AppConfig):
    """Configuration for the Object Storage app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "object_storage"
    verbose_name = "Object Storage System"

    def ready(self):
        """Initialize the app when Django starts."""
        # Import signals or other initialization code here if needed
        pass
