"""
Landing Page Layout implementation.
"""

from eceee_layouts.layouts.shared_slots import header, navbar, footer
from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class LandingPageLayout(BaseLayout):
    """Landing page layout optimized for conversions"""

    name = "landing_page"
    description = (
        "Full-width landing page layout with hero section and conversion focus"
    )
    template_name = "eceee_layouts/layouts/landing_page.html"
    css_classes = "layout-landing-page"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                header,
                navbar,
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area for articles and posts",
                    "max_widgets": None,
                    "css_classes": "slot-main",
                    "required": True,
                },
                footer,
            ]
        }
