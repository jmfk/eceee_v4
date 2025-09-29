"""
Example Custom Layout Classes

This module demonstrates how to create custom layouts that extend or replace
the default layouts provided by eceee_v4. These layouts can be used alongside
or instead of the default layouts.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class HeroLayout(BaseLayout):
    """Hero layout with large banner section and content areas"""

    name = "hero_layout"
    description = "Hero layout with large banner, content, and call-to-action areas"
    template_name = "example_custom_layouts/layouts/hero_layout.html"
    css_classes = "layout-hero"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "hero",
                    "title": "Hero Banner",
                    "description": "Main hero section with large visuals and headlines",
                    "max_widgets": 1,
                    "css_classes": "slot-hero",
                    "required": True,
                },
                {
                    "name": "content",
                    "title": "Main Content",
                    "description": "Primary content area below the hero",
                    "max_widgets": None,
                    "css_classes": "slot-content",
                },
                {
                    "name": "features",
                    "title": "Features Section",
                    "description": "Feature highlights or benefits",
                    "max_widgets": 6,
                    "css_classes": "slot-features",
                },
                {
                    "name": "cta",
                    "title": "Call to Action",
                    "description": "Call to action section",
                    "max_widgets": 2,
                    "css_classes": "slot-cta",
                },
            ]
        }


@register_layout
class DashboardLayout(BaseLayout):
    """Dashboard layout with multiple widget areas for admin interfaces"""

    name = "dashboard_layout"
    description = "Dashboard layout with header, sidebar, main content, and widget areas"
    template_name = "example_custom_layouts/layouts/dashboard_layout.html"
    css_classes = "layout-dashboard"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Dashboard Header",
                    "description": "Top header with navigation and user info",
                    "max_widgets": 3,
                    "css_classes": "slot-header",
                },
                {
                    "name": "sidebar",
                    "title": "Dashboard Sidebar",
                    "description": "Left sidebar with navigation menu",
                    "max_widgets": 5,
                    "css_classes": "slot-sidebar",
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary dashboard content area",
                    "max_widgets": None,
                    "css_classes": "slot-main",
                },
                {
                    "name": "widgets_top",
                    "title": "Top Widgets",
                    "description": "Top widget row for metrics and KPIs",
                    "max_widgets": 4,
                    "css_classes": "slot-widgets-top",
                },
                {
                    "name": "widgets_bottom",
                    "title": "Bottom Widgets",
                    "description": "Bottom widget area for charts and data",
                    "max_widgets": 6,
                    "css_classes": "slot-widgets-bottom",
                },
            ]
        }
