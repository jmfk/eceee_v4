from django.apps import AppConfig


class FileManagerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "file_manager"
    verbose_name = "File Manager"

    def ready(self):
        """Initialize app when Django starts."""
        # Import signals if any
        pass
