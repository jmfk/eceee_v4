"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from utils.dict_utils import DictToObj

from webpages.widget_registry import BaseWidget, register_widget_type


class HeaderConfig(BaseModel):
    """Configuration for Header widget - now theme-driven via design groups"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    name = "Header"
    description = (
        "Simple header widget with responsive image that scales to fill header height"
    )
    template_name = "easy_widgets/widgets/header.html"
    mustache_template_name = "easy_widgets/widgets/header.mustache"

    layout_parts = {
        "header-widget": {
            "label": "Header container",
            "selector": ".header-widget",
            "relationship": "same-element",  # Both widget-type and header-widget classes on same element
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
            ],
        },
    }

    widget_css = """
        .widget-type-header {
            width: 100%;
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
            height: var(--header-height-sm, 80px);
        }

        @media (min-width: 768px) {
            .widget-type-header {
                height: var(--header-height-md, 112px);
            }
        }

        @media (min-width: 1024px) {
            .widget-type-header {
                height: var(--header-height-lg, 112px);
            }
        }

        @media (min-width: 1280px) {
            .widget-type-header {
                height: var(--header-height-xl, 112px);
            }
        }
    """

    css_variables = {}

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
