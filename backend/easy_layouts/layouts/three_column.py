"""
Three Column Layout implementation.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class ThreeColumnLayout(BaseLayout):
    """Three column layout with header and footer"""

    name = "three_column"
    description = "Three column layout with left sidebar, main content, right sidebar, header and footer"
    template_name = "easy_layouts/layouts/three_column.html"
    css_classes = "layout-three-column"

    layout_css = """
    /* Three Column Layout CSS Variables */
    :root {
        --three-col-max-width: 1280px;
        --three-col-gap: 24px;
        --three-col-padding: 24px;
        --three-col-main-padding: 32px;
        --three-col-bg-white: #ffffff;
        --three-col-bg-gray: #f9fafb;
        --three-col-border-color: #e5e7eb;
        --three-col-border-radius: 8px;
        --three-col-footer-bg: #f3f4f6;
    }

    /* Container */
    .three-column-container {
        min-height: 100vh;
        background-color: var(--three-col-bg-white);
    }

    /* Inner Wrapper */
    .three-column-wrapper {
        max-width: var(--three-col-max-width);
        margin-left: auto;
        margin-right: auto;
        padding: 16px;
        padding-top: 32px;
        padding-bottom: 32px;
    }

    /* Grid Container */
    .three-column-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--three-col-gap);
    }

    /* Header */
    .three-column-header {
        grid-column: span 3;
        background-color: var(--three-col-bg-white);
        border-radius: var(--three-col-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--three-col-border-color);
        padding: var(--three-col-padding);
        margin-bottom: 16px;
    }

    /* Left Sidebar */
    .three-column-left-sidebar {
        grid-column: span 1;
        background-color: var(--three-col-bg-gray);
        border-radius: var(--three-col-border-radius);
        border: 1px solid var(--three-col-border-color);
        padding: var(--three-col-padding);
    }

    /* Main Content */
    .three-column-main {
        grid-column: span 1;
        background-color: var(--three-col-bg-white);
        border-radius: var(--three-col-border-radius);
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        border: 1px solid var(--three-col-border-color);
        padding: var(--three-col-main-padding);
    }

    /* Right Sidebar */
    .three-column-right-sidebar {
        grid-column: span 1;
        background-color: var(--three-col-bg-gray);
        border-radius: var(--three-col-border-radius);
        border: 1px solid var(--three-col-border-color);
        padding: var(--three-col-padding);
    }

    /* Footer */
    .three-column-footer {
        grid-column: span 3;
        background-color: var(--three-col-footer-bg);
        border-radius: var(--three-col-border-radius);
        border: 1px solid var(--three-col-border-color);
        padding: var(--three-col-padding);
        margin-top: 16px;
    }

    /* Responsive: Stack on smaller screens */
    @media (max-width: 1024px) {
        .three-column-grid {
            grid-template-columns: 1fr;
        }

        .three-column-header,
        .three-column-left-sidebar,
        .three-column-main,
        .three-column-right-sidebar,
        .three-column-footer {
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
                    "description": "Page header spanning all columns",
                    "max_widgets": 2,
                    "css_classes": "three-col-header",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
                {
                    "name": "left_sidebar",
                    "title": "Left Sidebar",
                    "description": "Left sidebar for complementary content",
                    "max_widgets": 4,
                    "css_classes": "three-col-left",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 405, "height": None},
                    },
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area",
                    "max_widgets": None,
                    "css_classes": "three-col-main",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 405, "height": None},
                    },
                },
                {
                    "name": "right_sidebar",
                    "title": "Right Sidebar",
                    "description": "Right sidebar for widgets and tools",
                    "max_widgets": 4,
                    "css_classes": "three-col-right",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 405, "height": None},
                    },
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer spanning all columns",
                    "max_widgets": 2,
                    "css_classes": "three-col-footer",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 1280, "height": None},
                    },
                },
            ]
        }

