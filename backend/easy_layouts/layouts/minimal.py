"""
Minimal Layout implementation.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class MinimalLayout(BaseLayout):
    """Minimal layout focused on readability and content"""

    name = "minimal"
    description = "Minimalist layout optimized for reading and focused presentation"
    template_name = "easy_layouts/layouts/minimal.html"
    css_classes = "layout-minimal"

    layout_parts = {
        "slot-header": {
            "label": "Header slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
        "slot-content": {
            "label": "Content slot container",
            "properties": ["gap", "display", "flexDirection"],
        },
    }

    layout_css = """
    /* Minimal Layout CSS Variables */
    :root {
        --minimal-max-width: 896px;
        --minimal-header-bg: rgba(255, 255, 255, 0.95);
        --minimal-border-color: #e5e7eb;
        --minimal-text-color: #374151;
        --minimal-heading-color: #111827;
        --minimal-focus-color: #3b82f6;
        --minimal-hover-bg: rgba(249, 250, 251, 0.7);
    }

    /* Container */
    .minimal-layout-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
        font-family: sans-serif;
    }

    /* Header */
    .minimal-layout-header {
        position: sticky;
        top: 0;
        z-index: 50;
        background-color: var(--minimal-header-bg);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--minimal-border-color);
        padding-top: 20px;
        padding-bottom: 20px;
    }

    .minimal-layout-header-inner {
        max-width: var(--minimal-max-width);
        margin-left: auto;
        margin-right: auto;
        padding-left: 32px;
        padding-right: 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .minimal-layout-header-placeholder {
        padding: 20px;
        border: 1px dashed #d1d5db;
        border-radius: 8px;
        text-align: center;
        color: #9ca3af;
        font-style: italic;
        font-size: 14px;
        transition: border-color 0.3s, background-color 0.3s;
    }

    .minimal-layout-header-placeholder:hover {
        border-color: #9ca3af;
    }

    /* Main Content */
    .minimal-layout-main {
        flex: 1;
        max-width: var(--minimal-max-width);
        margin-left: auto;
        margin-right: auto;
        width: 100%;
        padding: 64px 32px;
        line-height: 1.75;
        color: var(--minimal-text-color);
        font-size: 18px;
    }

    /* Prose Styles */
    .minimal-layout-prose {
        font-size: 18px;
        line-height: 1.75;
        max-width: none;
    }

    .minimal-layout-prose h1,
    .minimal-layout-prose h2,
    .minimal-layout-prose h3,
    .minimal-layout-prose h4,
    .minimal-layout-prose h5,
    .minimal-layout-prose h6 {
        color: var(--minimal-heading-color);
        font-weight: 600;
    }

    .minimal-layout-prose h1 {
        font-size: 36px;
        margin-top: 0;
        margin-bottom: 16px;
    }

    .minimal-layout-prose h2 {
        font-size: 30px;
        margin-top: 32px;
        margin-bottom: 16px;
    }

    .minimal-layout-prose h3 {
        font-size: 24px;
        margin-top: 32px;
        margin-bottom: 16px;
    }

    .minimal-layout-prose p {
        margin-bottom: 24px;
        max-width: 65ch;
    }

    .minimal-layout-content-placeholder {
        padding: 32px;
        border: 2px dashed #d1d5db;
        border-radius: 12px;
        text-align: center;
        color: #9ca3af;
        font-style: italic;
        font-size: 16px;
        max-width: none;
        transition: all 0.3s;
    }

    .minimal-layout-content-placeholder:hover {
        border-color: #9ca3af;
        background-color: var(--minimal-hover-bg);
        transform: translateY(-2px);
    }

    /* Focus states for accessibility */
    .minimal-layout *:focus {
        outline: 2px solid var(--minimal-focus-color);
        outline-offset: 2px;
    }

    /* Content width constraints for optimal readability */
    .minimal-layout-prose p,
    .minimal-layout-prose h1,
    .minimal-layout-prose h2,
    .minimal-layout-prose h3,
    .minimal-layout-prose h4,
    .minimal-layout-prose h5,
    .minimal-layout-prose h6 {
        max-width: 65ch;
    }

    /* Exception for placeholders */
    .minimal-layout-prose .minimal-layout-content-placeholder {
        max-width: none;
    }

    /* Tablet and mobile (768px and below) */
    @media (max-width: 768px) {
        .minimal-layout-header-inner {
            padding-left: 16px;
            padding-right: 16px;
        }

        .minimal-layout-main {
            padding: 40px 16px;
            font-size: 16px;
        }

        .minimal-layout-prose {
            font-size: 16px;
        }

        .minimal-layout-prose h1 {
            font-size: 30px;
        }

        .minimal-layout-prose h2 {
            font-size: 24px;
        }

        .minimal-layout-prose h3 {
            font-size: 20px;
        }
    }

    /* Print-friendly styles */
    @media print {
        .minimal-layout-header {
            position: static !important;
            border-bottom: 2px solid #000 !important;
        }

        .minimal-layout-main {
            padding: 20px 0 !important;
        }

        .minimal-layout-header-placeholder,
        .minimal-layout-content-placeholder {
            display: none !important;
        }
    }
    """

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Minimal Header",
                    "description": "Clean header area for navigation, branding, or minimal top content",
                    "max_widgets": 2,
                    "css_classes": "minimal-header",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
                {
                    "name": "content",
                    "title": "Main Content",
                    "description": "Primary content area optimized for reading and focused presentation",
                    "max_widgets": None,
                    "css_classes": "minimal-content",
                    "dimensions": {
                        "mobile": {"width": 640, "height": None},
                        "tablet": {"width": 1024, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
            ]
        }

