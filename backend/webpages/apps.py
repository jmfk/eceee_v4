from django.apps import AppConfig


class WebpagesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "webpages"

    def ready(self):
        """
        Called when the app is ready.
        Triggers layout and widget type autodiscovery to register all classes.
        """
        # Import here to avoid circular imports
        from .layout_autodiscovery import (
            autodiscover_layouts,
            validate_layout_configuration,
            LAYOUT_AUTODISCOVERY_ENABLED,
            LAYOUT_VALIDATION_ON_STARTUP,
        )
        from .widget_autodiscovery import (
            autodiscover_widgets,
            validate_widget_types,
        )

        if LAYOUT_AUTODISCOVERY_ENABLED:
            autodiscover_layouts()

            if LAYOUT_VALIDATION_ON_STARTUP:
                validate_layout_configuration()

        # Always autodiscover widget types
        autodiscover_widgets()

        # Validate widget types on startup in debug mode
        from django.conf import settings

        if settings.DEBUG:
            validation_results = validate_widget_types()
            if not validation_results["valid"]:
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Widget type validation issues found: {validation_results['issues']}"
                )
