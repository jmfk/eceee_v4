from django.apps import AppConfig


class DefaultLayoutsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "easy_layouts"
    verbose_name = "Easy Layouts"

    def ready(self):
        """
        Called when the app is ready.
        Import layouts to trigger automatic registration.
        """
        # Import layouts to trigger registration
        from . import layouts
