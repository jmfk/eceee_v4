"""
Error layouts for the CMS.
"""

from typing import Any, Dict

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
class ErrorLayout(BaseErrorLayout):
    """Compatibility wrapper while Django layout rendering is being retired."""

    name = "error_layout"
    description = "Shared layout for site-owned HTTP error pages"
    template_name = "webpages/page_detail.html"

    @property
    def slot_configuration(self) -> Dict[str, Any]:
        """Expose the canonical Theme Layout slots instead of legacy status-page slots."""
        return {
            "slots": [
                {
                    "name": "visual",
                    "title": "Illustration",
                    "description": "An image or other visual that supports the error message.",
                    "max_widgets": 1,
                    "collapse_behavior": "any",
                    "allowed_types": ["easy_widgets.ImageWidget"],
                },
                {
                    "name": "message",
                    "title": "Error Message",
                    "description": "Status-specific heading and explanatory text.",
                    "max_widgets": None,
                    "required": True,
                    "collapse_behavior": "never",
                    "allowed_types": ["easy_widgets.HeadlineWidget", "easy_widgets.ContentWidget"],
                },
                {
                    "name": "actions",
                    "title": "Helpful Actions",
                    "description": "Links and widgets that help visitors recover.",
                    "max_widgets": None,
                    "collapse_behavior": "any",
                    "disallowed_types": [
                        "easy_widgets.FooterWidget",
                        "easy_widgets.HeaderWidget",
                        "easy_widgets.NavbarWidget",
                    ],
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
