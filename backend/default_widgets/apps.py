from django.apps import AppConfig


class DefaultWidgetsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "default_widgets"
    verbose_name = "Default Widgets"

    def ready(self):
        """
        Called when the app is ready.
        Import widgets to trigger automatic registration.
        """
        # Import widgets to trigger registration
        from . import widgets
