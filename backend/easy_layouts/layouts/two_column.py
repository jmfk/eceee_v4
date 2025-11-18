"""
Two Column Layout implementation.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class TwoColumnLayout(BaseLayout):
    """Two column layout with header and footer"""

    name = "two_column"
    description = "Two column layout with main content, sidebar, header and footer"
    template_name = "easy_layouts/layouts/two_column.html"
    css_classes = "layout-two-column"

    layout_css = """
    /* Two Column Layout CSS Variables */
    :root {
        --two-col-max-width: 1152px;
        --two-col-gap: 32px;
        --two-col-padding: 24px;
        --two-col-main-padding: 32px;
        --two-col-bg-white: #ffffff;
        --two-col-bg-gray: #f9fafb;
        --two-col-border-color: #e5e7eb;
        --two-col-border-radius: 8px;
        --two-col-footer-bg: #f3f4f6;
    }

    /* Container */
    .two-column-container {
        min-height: 100vh;
        background-color: var(--two-col-bg-white);
    }

    /* Inner Wrapper */
    .two-column-wrapper {
        max-width: var(--two-col-max-width);
        margin-left: auto;
        margin-right: auto;
        padding: 16px;
        padding-top: 32px;
        padding-bottom: 32px;
    }

    /* Grid Container */
    .two-column-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--two-col-gap);
    }

    /* Header */
    .two-column-header {
        grid-column: span 2;
        background-color: var(--two-col-bg-white);
        border-radius: var(--two-col-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--two-col-border-color);
        padding: var(--two-col-padding);
        margin-bottom: 16px;
    }

    /* Main Content */
    .two-column-main {
        grid-column: span 1;
        background-color: var(--two-col-bg-white);
        border-radius: var(--two-col-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--two-col-border-color);
        padding: var(--two-col-main-padding);
    }

    /* Sidebar */
    .two-column-sidebar {
        grid-column: span 1;
        background-color: var(--two-col-bg-gray);
        border-radius: var(--two-col-border-radius);
        border: 1px solid var(--two-col-border-color);
        padding: var(--two-col-padding);
    }

    /* Footer */
    .two-column-footer {
        grid-column: span 2;
        background-color: var(--two-col-footer-bg);
        border-radius: var(--two-col-border-radius);
        border: 1px solid var(--two-col-border-color);
        padding: var(--two-col-padding);
        margin-top: 16px;
    }

    /* Responsive: Stack on smaller screens */
    @media (max-width: 768px) {
        .two-column-grid {
            grid-template-columns: 1fr;
        }

        .two-column-header,
        .two-column-main,
        .two-column-sidebar,
        .two-column-footer {
            grid-column: span 1;
        }
    }
    """

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Page header spanning both columns",
                    "max_widgets": 2,
                    "css_classes": "two-col-header",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1152, "height": None},
                    },
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content column",
                    "max_widgets": None,
                    "css_classes": "two-col-main",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 560, "height": None},
                    },
                },
                {
                    "name": "sidebar",
                    "title": "Sidebar",
                    "description": "Secondary content sidebar",
                    "max_widgets": 5,
                    "css_classes": "two-col-sidebar",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 560, "height": None},
                    },
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer spanning both columns",
                    "max_widgets": 2,
                    "css_classes": "two-col-footer",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1152, "height": None},
                    },
                },
            ]
        }

