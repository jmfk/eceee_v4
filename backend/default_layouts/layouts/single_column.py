"""
Single Column Layout implementation.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class SingleColumnLayout(BaseLayout):
    """Simple single-column layout suitable for most content pages"""

    name = "single_column"
    description = (
        "Single column layout with header, main content, sidebar, and footer areas"
    )
    template_name = "default_layouts/layouts/single_column.html"
    css_classes = "layout-single-column"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Page header content",
                    "max_widgets": 3,
                    "css_classes": "slot-header",
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary page content area",
                    "max_widgets": None,  # Unlimited widgets
                    "css_classes": "slot-main",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>Welcome to Your Site</h2><p>This is the main content area. Add widgets to customize this space.</p>",
                                "format": "html",
                            },
                        },
                        {
                            "type": "image",
                            "config": {
                                "url": "/static/images/placeholder.jpg",
                                "alt": "Placeholder image",
                                "caption": "Example image widget",
                            },
                        },
                    ],
                },
                {
                    "name": "sidebar",
                    "title": "Sidebar",
                    "description": "Complementary content and widgets",
                    "max_widgets": 4,
                    "css_classes": "slot-sidebar",
                    "default_widgets": [
                        {
                            "type": "recent_posts",
                            "config": {"count": 3, "show_excerpt": True},
                        },
                        {
                            "type": "social_media",
                            "config": {"platforms": ["twitter", "facebook"]},
                        },
                    ],
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer content",
                    "max_widgets": 2,
                    "css_classes": "slot-footer",
                },
            ]
        }

