"""
Landing Page Layout implementation.
"""

from easy_layouts.layouts.shared_slots import header, navbar, footer, hero
from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class LandingPageLayout(BaseLayout):
    """Landing page layout optimized for conversions"""

    name = "landing_page"
    description = (
        "Full-width landing page layout with hero section and conversion focus"
    )
    template_name = "easy_layouts/layouts/landing_page.html"
    css_classes = "layout-landing-page"

    layout_parts = {
        "slot-landing-page": {
            "label": "Landing page slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-header": {
            "label": "Header slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-navbar": {
            "label": "Navbar slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-hero": {
            "label": "Hero slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-footer": {
            "label": "Footer slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
    }

    layout_css = """
    /* Landing Page Layout CSS Variables */
    :root {
        --landing-bg-outer: #9ca3af;
        --landing-bg-white: #ffffff;
        --landing-max-width: 1280px;
        --landing-spacing: 30px;
        --landing-footer-min-height: 310px;
        --landing-main-min-height: 310px;
    }

    /* Landing Page Container */
    .landing-page-container {
        min-height: 100vh;
        background-color: var(--landing-bg-outer);
        display: flex;
        flex-direction: column;
    }

    /* Landing Page Inner Wrapper */
    .landing-page-wrapper {
        width: 100%;
        max-width: var(--landing-max-width);
        margin-left: auto;
        margin-right: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: var(--landing-bg-white);
    }

    /* Landing Page Main Content */
    .landing-page-main {
        background-color: var(--landing-bg-white);
        padding: var(--landing-spacing);
        min-height: var(--landing-main-min-height);
    }

    /* Landing Page Footer */
    .landing-page-footer {
        min-height: var(--landing-footer-min-height);
        display: flex;
        flex-direction: column;
    }
    
    .landing-page-footer .slot-footer {
        min-height: var(--landing-footer-min-height);
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    """

    @property
    def slot_configuration(self):
        return {
            "slots": [
                header,
                navbar,
                hero,
                {
                    "name": "landing_page",
                    "title": "Landing Page Main Content",
                    "description": "Primary content area for articles and posts",
                    "max_widgets": None,
                    "css_classes": "slot-landing-page",
                    "required": True,
                    "allowed_types": [
                        "easy_widgets.BannerWidget",
                        "easy_widgets.HeroWidget",
                        "easy_widgets.TwoColumnsWidget",
                        "easy_widgets.ThreeColumnsWidget",
                    ],
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                    "order": 40,  # After hero
                },
                footer,
            ]
        }
