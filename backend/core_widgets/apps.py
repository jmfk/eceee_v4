from django.apps import AppConfig


class CoreWidgetsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core_widgets"
    verbose_name = "Core Widgets"
    
    def ready(self):
        """Initialize the app - widget autodiscovery will be handled by webpages app."""
        pass
