"""
Error layouts for the CMS.
"""

from typing import Dict, Any
from webpages.layout_registry import BaseLayout, register_layout


class BaseErrorLayout(BaseLayout):
    """Base class for all error layouts"""

    template_name = "default_layouts/layouts/error_base.html"

    @property
    def slot_configuration(self) -> Dict[str, Any]:
        return {
            "slots": [
                {
                    "name": "branding",
                    "title": "Branding",
                    "description": "Site logo and branding",
                    "max_widgets": 1,
                },
                {
                    "name": "error_message",
                    "title": "Error Message",
                    "description": "Main error message and explanation",
                    "max_widgets": None,
                },
                {
                    "name": "helpful_content",
                    "title": "Helpful Content",
                    "description": "Suggestions and links to help users",
                    "max_widgets": None,
                },
            ]
        }


@register_layout
class Error404Layout(BaseErrorLayout):
    name = "error_404"
    description = "404 Not Found pages"
    template_name = "default_layouts/layouts/error_404.html"


@register_layout
class Error500Layout(BaseErrorLayout):
    name = "error_500"
    description = "500 Internal Server Error pages"
    template_name = "default_layouts/layouts/error_500.html"


@register_layout
class Error403Layout(BaseErrorLayout):
    name = "error_403"
    description = "403 Forbidden pages"
    template_name = "default_layouts/layouts/error_403.html"


@register_layout
class Error503Layout(BaseErrorLayout):
    name = "error_503"
    description = "503 Service Unavailable pages"
    template_name = "default_layouts/layouts/error_503.html"
