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

    layout_parts = {
        "slot-main": {
            "label": "Main slot container",
            "selector": ".slot-main",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-sidebar": {
            "label": "Sidebar slot container",
            "selector": ".slot-sidebar",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-header": {
            "label": "Header slot container",
            "selector": ".slot-header",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-navbar": {
            "label": "Navbar slot container",
            "selector": ".slot-navbar",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-hero": {
            "label": "Hero slot container",
            "selector": ".slot-hero",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-footer": {
            "label": "Footer slot container",
            "selector": ".slot-footer",
            "properties": ["gap", "display", "flexDirection"],
        },
    }

    layout_css = """
    /* Main Layout CSS Variables */
    :root {
        --main-layout-bg-outer: #9ca3af;
        --main-layout-bg-white: #ffffff;
        --main-layout-max-width: 1280px;
        --main-layout-gap: 30px;
        --main-layout-padding-x: 40px;
        --main-layout-padding-y: 30px;
        --main-layout-footer-min-height: 310px;
        --main-content-max-width-default: 650px;
        --main-content-max-width-xl: 790px;
        --main-sidebar-min-height: 310px;
    }

    /* Main Layout Container */
    .main-layout-container {
        min-height: 100vh;
        background-color: var(--main-layout-bg-outer);
        display: flex;
        flex-direction: column;
    }

    /* Main Layout Inner Wrapper */
    .main-layout-wrapper {
        width: 100%;
        max-width: var(--main-layout-max-width);
        margin-left: auto;
        margin-right: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: var(--main-layout-bg-white);
    }

    /* Main Layout Grid */
    .main-layout-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--main-layout-gap);
        padding: var(--main-layout-padding-y) var(--main-layout-padding-x);
        flex: 1;
        min-height: 300px;
    }

    /* Main Content Area */
    .main-layout-main {
        margin-left: auto;
        margin-right: auto;
        padding: 0;
        margin-top: 0;
        margin-bottom: 0;
        max-width: var(--main-content-max-width-default);
    }

    /* Sidebar Area */
    .main-layout-aside {
        display: grid;
        grid-template-columns: 1fr;
        min-height: var(--main-sidebar-min-height);
        gap: var(--main-layout-gap);
    }

    /* Footer */
    .main-layout-footer {
        min-height: var(--main-layout-footer-min-height);
        display: flex;
        flex-direction: column;
    }
    
    .main-layout-footer .slot-footer {
        min-height: var(--main-layout-footer-min-height);
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    /* Tablet breakpoint (768px and up) */
    @media (min-width: 768px) {
        .main-layout-aside {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    /* Large breakpoint (1024px and up) */
    @media (min-width: 1024px) {
        .main-layout-grid {
            grid-template-columns: repeat(3, 1fr);
        }

        .main-layout-main {
            grid-column: span 2;
        }

        .main-layout-aside {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }
    }

    /* XL breakpoint (1280px and up) */
    @media (min-width: 1280px) {
        .main-layout-main {
            margin-left: 0;
            margin-right: 0;
            max-width: var(--main-content-max-width-xl);
        }
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
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary page content area",
                    "order": 50,  # Middle of page
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
                    "order": 60,  # After main content
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
