"""
Header widget implementation.
"""

from typing import Type

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


class HeaderConfig(BaseModel):
    """Configuration for Header widget - now theme-driven via design groups"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


@register_widget_type
@catalog_widget
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    description = (
        "Header widget - xs breakpoint shows full image (auto height), sm+ uses fixed height with cropped image"
    )
    template_name = None
    mustache_template_name = "easy_widgets/widgets/header.mustache"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig

    def prepare_template_context(self, config, context=None):
        """Prepare header template context for Mustache template"""
        template_config = super().prepare_template_context(config, context)

        # Add widget type CSS class (normalized)
        template_config["widgetTypeCssClass"] = self.css_class_name

        return template_config
