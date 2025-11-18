"""
Sidebar Layout implementation.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class SidebarLayout(BaseLayout):
    """Multi-section sidebar layout for content-rich pages"""

    name = "sidebar_layout"
    description = "Layout with header, main content, multi-section sidebar, and footer"
    template_name = "easy_layouts/layouts/sidebar_layout.html"
    css_classes = "layout-sidebar"

    layout_parts = {
        "slot-header": {
            "label": "Header slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-main": {
            "label": "Main slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-sidebar-top": {
            "label": "Sidebar top slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-sidebar-middle": {
            "label": "Sidebar middle slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-sidebar-bottom": {
            "label": "Sidebar bottom slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-footer": {
            "label": "Footer slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
    }

    layout_css = """
    /* Sidebar Layout CSS Variables */
    :root {
        --sidebar-layout-bg: #f9fafb;
        --sidebar-layout-gap: 24px;
        --sidebar-layout-padding: 32px;
        --sidebar-layout-padding-md: 24px;
        --sidebar-layout-padding-sm: 20px;
        --sidebar-layout-border-radius: 12px;
        --sidebar-layout-bg-white: #ffffff;
        --sidebar-layout-border-color: #e5e7eb;
        --sidebar-layout-footer-bg: #374151;
        --sidebar-layout-footer-text: #ffffff;
        --sidebar-layout-section-spacing: 20px;
    }

    /* Container */
    .sidebar-layout-container {
        min-height: 100vh;
        padding: 24px;
        background-color: var(--sidebar-layout-bg);
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--sidebar-layout-gap);
        grid-template-rows: auto 1fr auto;
    }

    /* Header */
    .sidebar-layout-header {
        grid-column: span 1;
        background-color: var(--sidebar-layout-bg-white);
        padding: var(--sidebar-layout-padding);
        border-radius: var(--sidebar-layout-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--sidebar-layout-border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    /* Main Content */
    .sidebar-layout-main {
        grid-column: span 1;
        background-color: var(--sidebar-layout-bg-white);
        padding: var(--sidebar-layout-padding);
        border-radius: var(--sidebar-layout-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--sidebar-layout-border-color);
        overflow-y: auto;
        line-height: 1.75;
        font-size: 16px;
    }

    /* Sidebar */
    .sidebar-layout-aside {
        grid-column: span 1;
        background-color: var(--sidebar-layout-bg-white);
        padding: var(--sidebar-layout-padding);
        border-radius: var(--sidebar-layout-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--sidebar-layout-border-color);
        display: flex;
        flex-direction: column;
        gap: var(--sidebar-layout-section-spacing);
        font-size: 14px;
    }

    .sidebar-layout-section {
        padding-bottom: var(--sidebar-layout-section-spacing);
        border-bottom: 1px solid var(--sidebar-layout-border-color);
    }

    .sidebar-layout-section:last-child {
        border-bottom: 0;
        padding-bottom: 0;
    }

    /* Footer */
    .sidebar-layout-footer {
        grid-column: span 1;
        background-color: var(--sidebar-layout-footer-bg);
        color: var(--sidebar-layout-footer-text);
        padding: 24px;
        border-radius: var(--sidebar-layout-border-radius);
        text-align: center;
    }

    /* Small screens (max 640px) */
    @media (max-width: 640px) {
        .sidebar-layout-container {
            padding: 16px;
            gap: 16px;
        }

        .sidebar-layout-header,
        .sidebar-layout-main,
        .sidebar-layout-aside {
            padding: var(--sidebar-layout-padding-sm);
        }

        .sidebar-layout-footer {
            padding: var(--sidebar-layout-padding-sm);
        }
    }

    /* Medium screens (641px to 767px) */
    @media (min-width: 641px) and (max-width: 767px) {
        .sidebar-layout-container {
            padding: 20px;
            gap: 20px;
        }

        .sidebar-layout-header,
        .sidebar-layout-main,
        .sidebar-layout-aside {
            padding: var(--sidebar-layout-padding-md);
        }

        .sidebar-layout-footer {
            padding: var(--sidebar-layout-padding-md);
        }
    }

    /* Tablet (768px and up) */
    @media (min-width: 768px) {
        .sidebar-layout-container {
            grid-template-columns: repeat(3, 1fr);
        }

        .sidebar-layout-header {
            grid-column: span 3;
        }

        .sidebar-layout-main {
            grid-column: span 2;
        }

        .sidebar-layout-aside {
            grid-column: span 1;
        }

        .sidebar-layout-footer {
            grid-column: span 3;
        }
    }

    /* Large screens (1024px and up) */
    @media (min-width: 1024px) {
        .sidebar-layout-container {
            grid-template-columns: 2fr 1fr;
        }

        .sidebar-layout-header {
            grid-column: span 2;
        }

        .sidebar-layout-main {
            grid-column: span 1;
        }

        .sidebar-layout-aside {
            grid-column: span 1;
        }

        .sidebar-layout-footer {
            grid-column: span 2;
        }
    }
    """

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Page Header",
                    "description": "Site navigation, branding, and header content",
                    "max_widgets": 3,
                    "css_classes": "sidebar-header",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area for articles, posts, and main page content",
                    "max_widgets": None,
                    "css_classes": "sidebar-main",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 682, "height": None},
                        "desktop": {"width": 853, "height": None},
                    },
                },
                {
                    "name": "sidebar-top",
                    "title": "Sidebar Top",
                    "description": "Top sidebar widgets like recent posts, categories, or featured content",
                    "max_widgets": 3,
                    "css_classes": "sidebar-top",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 341, "height": None},
                        "desktop": {"width": 427, "height": None},
                    },
                },
                {
                    "name": "sidebar-middle",
                    "title": "Sidebar Middle",
                    "description": "Middle sidebar area for ads, social media, or related content",
                    "max_widgets": 4,
                    "css_classes": "sidebar-middle",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 341, "height": None},
                        "desktop": {"width": 427, "height": None},
                    },
                },
                {
                    "name": "sidebar-bottom",
                    "title": "Sidebar Bottom",
                    "description": "Bottom sidebar widgets for archives, tags, or supplementary content",
                    "max_widgets": 3,
                    "css_classes": "sidebar-bottom",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 341, "height": None},
                        "desktop": {"width": 427, "height": None},
                    },
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Site footer with links, copyright, and contact information",
                    "max_widgets": 2,
                    "css_classes": "sidebar-footer",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
            ]
        }

