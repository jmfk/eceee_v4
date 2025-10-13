"""
Path Debug Widget

Displays path variables captured from URL regex patterns for debugging
and testing the dynamic object publishing system.
"""

from webpages.widget_registry import BaseWidget, widget_type_registry
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Optional


class PathDebugConfig(BaseModel):
    """Configuration for Path Debug widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class PathDebugWidget(BaseWidget):
    """
    Widget that displays captured path variables for debugging.

    Useful for testing path pattern configurations and understanding
    what variables are being extracted from URLs.
    """

    name = "Path Debug"
    description = "Debug widget showing captured path variables from URL patterns"
    category = "Development"
    icon = "bug"
    template_name = "eceee_widgets/widgets/path_debug.html"
    configuration_model = PathDebugConfig

    # Widget is for development/debugging
    is_development_only = True

    def prepare_template_context(self, config, context=None):
        """
        Add pattern registry lookup to config.
        Template will access raw page context (path_variables, current_page, etc.) at root level.
        """
        template_config = super().prepare_template_context(config, context)

        # Get page info from context
        current_page = context.get("current_page") if context else None

        # Do registry lookup (this is logic that shouldn't be in template)
        pattern_info = None
        if (
            current_page
            and hasattr(current_page, "path_pattern_key")
            and current_page.path_pattern_key
        ):
            from webpages.path_pattern_registry import path_pattern_registry

            pattern = path_pattern_registry.get_pattern(current_page.path_pattern_key)
            if pattern:
                pattern_info = {
                    "key": current_page.path_pattern_key,
                    "name": pattern.name,
                    "regex": pattern.regex_pattern,
                    "description": pattern.description,
                    "example_url": pattern.example_url,
                }

        # Add computed data to config
        template_config["pattern_info"] = pattern_info

        return template_config


# Register the widget
widget_type_registry.register(PathDebugWidget)
