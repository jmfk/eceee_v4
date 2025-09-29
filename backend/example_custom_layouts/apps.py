from django.apps import AppConfig


class ExampleCustomLayoutsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'example_custom_layouts'
    verbose_name = 'Example Custom Layouts'
    
    def ready(self):
        """
        Called when the app is ready.
        Import layouts to trigger automatic registration.
        """
        # Import layouts to trigger registration
        from . import layouts
