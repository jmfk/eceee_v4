"""
Main Layout implementation.
"""

from easy_layouts.layouts.shared_slots import header, navbar, footer, hero
from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class MainLayoutLayout(BaseLayout):
    """Simple single-column layout suitable for most content pages"""

    name = "main_layout"
    description = (
        "Single column layout with header, main content, sidebar, and footer areas"
    )
    template_name = "easy_layouts/layouts/main_layout.html"
    css_classes = "layout-single-column"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                header,
                navbar,
                hero,
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary page content area",
                    "max_widgets": None,  # Unlimited widgets
                    "css_classes": "main",
                    "default_widgets": [
                        {
                            "type": "content",
                            "config": {
                                "content": "<h2>Welcome to Your Site</h2><p>This is the main content area. Add widgets to customize this space.</p>",
                                "format": "html",
                            },
                        },
                    ],
                    "allows_inheritance": False,
                    "disallowed_types": [
                        "easy_widgets.FooterWidget",
                        "easy_widgets.NavbarWidget",
                        "easy_widgets.HeaderWidget",
                    ],
                    "allow_merge": False,  # Main content is page-specific, no merge
                    "collapse_behavior": "never",  # Never collapse - always show in edit mode
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
                {
                    "name": "sidebar",
                    "title": "Sidebar",
                    "description": "Complementary content and widgets",
                    "css_classes": "sidebar",
                    "default_widgets": [],
                    "allows_inheritance": True,
                    "allow_merge": True,  # Enable merge mode for additive widgets
                    "inheritable_types": [],
                    "disallowed_types": [
                        "easy_widgets.FooterWidget",
                        "easy_widgets.NavbarWidget",
                        "easy_widgets.HeaderWidget",
                    ],
                    "collapse_behavior": "all",  # Collapse only if all widgets are inherited
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
                footer,
            ]
        }
