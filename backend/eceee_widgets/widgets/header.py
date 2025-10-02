"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field

from webpages.widget_registry import BaseWidget, register_widget_type


class HeaderConfig(BaseModel):
    """Configuration for Header widget"""

    image: Optional[str] = Field(
        None,
        description="Header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 1,
            "mediaTypes": ["image"],
        },
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    name = "Header"
    description = "Simple header widget with image"
    template_name = "eceee_widgets/widgets/header.html"

    widget_css = """
    .header-widget {
        width: 100%;
        display: block;
    }
    
    .header-widget img {
        width: 100%;
        height: auto;
        display: block;
    }
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig
