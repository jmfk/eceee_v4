from django.apps import AppConfig


class WebpagesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "webpages"

    def ready(self):
        """
        Called when the app is ready.
        Triggers layout and widget type autodiscovery and imports cache invalidation signals.
        """
        # Import signals for cache invalidation and cached_path maintenance
        import webpages.signals

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
        from .path_pattern_autodiscovery import (
            autodiscover_path_patterns,
            validate_path_patterns,
        )

        if LAYOUT_AUTODISCOVERY_ENABLED:
            autodiscover_layouts()

            if LAYOUT_VALIDATION_ON_STARTUP:
                validate_layout_configuration()

        # Always autodiscover widget types
        autodiscover_widgets()

        # Always autodiscover path patterns
        autodiscover_path_patterns()

        # Validate widget types and path patterns on startup in debug mode
        from django.conf import settings

        if settings.DEBUG:
            validation_results = validate_widget_types()
            if not validation_results["valid"]:
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Widget type validation issues found: {validation_results['issues']}"
                )

            pattern_validation = validate_path_patterns()
            if not pattern_validation["valid"]:
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Path pattern validation issues found: {pattern_validation['issues']}"
                )
