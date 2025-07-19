"""
Example Layout Classes for the Web Page Publishing System

This module demonstrates how to create code-based layouts using the new layout registry system.
These layouts serve as examples and provide default layouts for the system.
"""

from .layout_registry import BaseLayout, register_layout


@register_layout
class SingleColumnLayout(BaseLayout):
    """Simple single-column layout suitable for most content pages"""

    name = "single_column"
    description = "Single column layout with header, main content, and footer areas"
    template_name = "webpages/layouts/single_column.html"
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


@register_layout
class TwoColumnLayout(BaseLayout):
    """Two-column layout with sidebar for complementary content"""

    name = "two_column"
    description = "Two column layout with main content area and sidebar"
    template_name = "webpages/layouts/two_column.html"
    css_classes = "layout-two-column"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Page header spanning both columns",
                    "max_widgets": 2,
                    "css_classes": "slot-header col-span-2",
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content column",
                    "max_widgets": None,
                    "css_classes": "slot-main col-span-1",
                },
                {
                    "name": "sidebar",
                    "title": "Sidebar",
                    "description": "Secondary content sidebar",
                    "max_widgets": 5,
                    "css_classes": "slot-sidebar col-span-1",
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer spanning both columns",
                    "max_widgets": 2,
                    "css_classes": "slot-footer col-span-2",
                },
            ]
        }


@register_layout
class ThreeColumnLayout(BaseLayout):
    """Three-column layout for complex content organization"""

    name = "three_column"
    description = (
        "Three column layout with left sidebar, main content, and right sidebar"
    )
    template_name = "webpages/layouts/three_column.html"
    css_classes = "layout-three-column"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Page header spanning all columns",
                    "max_widgets": 1,
                    "css_classes": "slot-header col-span-3",
                },
                {
                    "name": "left_sidebar",
                    "title": "Left Sidebar",
                    "description": "Left sidebar for navigation or secondary content",
                    "max_widgets": 4,
                    "css_classes": "slot-left-sidebar col-span-1",
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area",
                    "max_widgets": None,
                    "css_classes": "slot-main col-span-1",
                },
                {
                    "name": "right_sidebar",
                    "title": "Right Sidebar",
                    "description": "Right sidebar for complementary content",
                    "max_widgets": 4,
                    "css_classes": "slot-right-sidebar col-span-1",
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer spanning all columns",
                    "max_widgets": 2,
                    "css_classes": "slot-footer col-span-3",
                },
            ]
        }


@register_layout
class LandingPageLayout(BaseLayout):
    """Hero-style layout for landing pages and marketing content"""

    name = "landing_page"
    description = (
        "Landing page layout with hero section, features, and call-to-action areas"
    )
    template_name = "webpages/layouts/landing_page.html"
    css_classes = "layout-landing-page"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "hero",
                    "title": "Hero Section",
                    "description": "Large hero banner at top of page",
                    "max_widgets": 1,
                    "css_classes": "slot-hero",
                },
                {
                    "name": "features",
                    "title": "Features Section",
                    "description": "Highlight key features or benefits",
                    "max_widgets": 6,
                    "css_classes": "slot-features",
                },
                {
                    "name": "content",
                    "title": "Content Section",
                    "description": "Main content area",
                    "max_widgets": None,
                    "css_classes": "slot-content",
                },
                {
                    "name": "testimonials",
                    "title": "Testimonials",
                    "description": "Customer testimonials or social proof",
                    "max_widgets": 3,
                    "css_classes": "slot-testimonials",
                },
                {
                    "name": "cta",
                    "title": "Call to Action",
                    "description": "Primary call-to-action section",
                    "max_widgets": 1,
                    "css_classes": "slot-cta",
                },
            ]
        }


@register_layout
class MinimalLayout(BaseLayout):
    """Minimal layout for focused content presentation"""

    name = "minimal"
    description = "Clean, minimal layout with just header and content"
    template_name = "webpages/layouts/minimal.html"
    css_classes = "layout-minimal"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Simple header area",
                    "max_widgets": 1,
                    "css_classes": "slot-header",
                },
                {
                    "name": "content",
                    "title": "Content",
                    "description": "Main content area without distractions",
                    "max_widgets": None,
                    "css_classes": "slot-content",
                },
            ]
        }


class ConditionalLayout(BaseLayout):
    """
    Example of a layout with conditional availability.
    This layout is only active during business hours (demonstration purposes).
    """

    name = "conditional_example"
    description = "Example layout that's only available during business hours"
    template_name = "webpages/layouts/single_column.html"
    css_classes = "layout-conditional"

    @property
    def is_active(self):
        """Custom logic to determine if layout is available"""
        import datetime

        now = datetime.datetime.now()
        # Only active during business hours (9 AM to 5 PM)
        return 9 <= now.hour < 17

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Business hours content",
                    "max_widgets": None,
                    "css_classes": "slot-main",
                },
            ]
        }


# Example of registering a layout manually (alternative to decorator)
class CustomLayout(BaseLayout):
    """Example of manually registered layout"""

    name = "custom_manual"
    description = "Example of a manually registered layout"
    template_name = "webpages/layouts/single_column.html"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "content",
                    "title": "Content",
                    "description": "Custom content area",
                    "max_widgets": None,
                    "css_classes": "slot-content",
                },
            ]
        }


# Register the layout manually
from .layout_registry import layout_registry

layout_registry.register(CustomLayout)
