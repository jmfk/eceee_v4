from django.apps import AppConfig


class WebpagesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "webpages"

    def ready(self):
        """
        Called when the app is ready.
        Triggers layout autodiscovery to register all layout classes.
        """
        # Import here to avoid circular imports
        from .layout_autodiscovery import (
            autodiscover_layouts,
            validate_layout_configuration,
            LAYOUT_AUTODISCOVERY_ENABLED,
            LAYOUT_VALIDATION_ON_STARTUP,
        )

        if LAYOUT_AUTODISCOVERY_ENABLED:
            autodiscover_layouts()

            if LAYOUT_VALIDATION_ON_STARTUP:
                validate_layout_configuration()
