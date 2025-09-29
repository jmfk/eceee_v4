from django.apps import AppConfig


class DefaultLayoutsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "default_layouts"
    verbose_name = "Default Layouts"

    def ready(self):
        """
        Called when the app is ready.
        Import layouts to trigger automatic registration.
        """
        # Import layouts to trigger registration
        from . import layouts
