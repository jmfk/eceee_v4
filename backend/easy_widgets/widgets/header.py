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

    layout_parts = {
        "header-widget": {
            "label": "Header container",
            "selector": ".header-widget",
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
            background-image: var(--header-widget-background-sm, none);
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
            height: var(--header-height-sm, 80px);
        }

        @media (min-width: 768px) {
            .widget-type-header {
                background-image: var(--header-widget-background-md, var(--header-widget-background-sm, none));
                height: var(--header-height-md, 112px);
            }
        }

        @media (min-width: 1024px) {
            .widget-type-header {
                background-image: var(--header-widget-background-lg, none);
                height: var(--header-height-lg, 112px);
            }
        }

        @media (min-width: 1280px) {
            .widget-type-header {
                background-image: var(--header-widget-background-xl, none);
                height: var(--header-height-xl, 112px);
            }
        }
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig
