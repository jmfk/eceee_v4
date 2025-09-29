"""
Default Layout Classes for the Web Page Publishing System

This module contains the default layouts that ship with eceee_v4.
These layouts can be disabled by removing 'default_layouts' from INSTALLED_APPS,
or completely replaced by creating custom layout apps.
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


@register_layout
class TwoColumnLayout(BaseLayout):
    """Two-column layout with sidebar for complementary content"""

    name = "two_column"
    description = "Two column layout with main content area and sidebar"
    template_name = "default_layouts/layouts/two_column.html"
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
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>Welcome to Your Site</h1><p>Header content area for branding and navigation.</p>",
                                "format": "html",
                            },
                        }
                    ],
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content column",
                    "max_widgets": None,
                    "css_classes": "slot-main col-span-1",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>Main Content Area</h2><p>This is the primary content area. Add widgets to customize this space with articles, images, and other content.</p>",
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
                    "description": "Secondary content sidebar",
                    "max_widgets": 5,
                    "css_classes": "slot-sidebar col-span-1",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h3>Sidebar</h3><p>Complementary content and widgets.</p>",
                                "format": "html",
                            },
                        },
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
                    "description": "Page footer spanning both columns",
                    "max_widgets": 2,
                    "css_classes": "slot-footer col-span-2",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<p>&copy; 2024 Your Website. All rights reserved.</p>",
                                "format": "html",
                            },
                        }
                    ],
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
    template_name = "default_layouts/layouts/three_column.html"
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
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>Welcome to Your Site</h1><p>Header content area for branding and navigation.</p>",
                                "format": "html",
                            },
                        }
                    ],
                },
                {
                    "name": "left_sidebar",
                    "title": "Left Sidebar",
                    "description": "Left sidebar for navigation or secondary content",
                    "max_widgets": 4,
                    "css_classes": "slot-left-sidebar col-span-1",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h3>Left Sidebar</h3><p>Navigation and secondary content.</p>",
                                "format": "html",
                            },
                        }
                    ],
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area",
                    "max_widgets": None,
                    "css_classes": "slot-main col-span-1",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>Main Content Area</h2><p>This is the primary content area. Add widgets to customize this space with articles, images, and other content.</p>",
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
                    "name": "right_sidebar",
                    "title": "Right Sidebar",
                    "description": "Right sidebar for complementary content",
                    "max_widgets": 4,
                    "css_classes": "slot-right-sidebar col-span-1",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h3>Right Sidebar</h3><p>Widgets and additional content.</p>",
                                "format": "html",
                            },
                        },
                        {
                            "type": "recent_posts",
                            "config": {"count": 3, "show_excerpt": True},
                        },
                    ],
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Page footer spanning all columns",
                    "max_widgets": 2,
                    "css_classes": "slot-footer col-span-3",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<p>&copy; 2024 Your Website. All rights reserved.</p>",
                                "format": "html",
                            },
                        }
                    ],
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
    template_name = "default_layouts/layouts/landing_page.html"
    css_classes = "layout-landing-page"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "navigation",
                    "title": "Navigation Bar",
                    "description": "Site navigation and branding",
                    "max_widgets": 3,
                    "css_classes": "slot-navigation",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<div class='flex items-center justify-between w-full'><div class='font-bold text-xl'>Your Brand</div><div class='hidden md:flex space-x-6'><a href='#' class='hover:text-indigo-600'>Home</a><a href='#' class='hover:text-indigo-600'>About</a><a href='#' class='hover:text-indigo-600'>Contact</a></div></div>",
                                "format": "html",
                            },
                        }
                    ],
                },
                {
                    "name": "hero",
                    "title": "Hero Section",
                    "description": "Main hero content with call-to-action",
                    "max_widgets": 3,
                    "css_classes": "slot-hero",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1 class='text-5xl md:text-6xl font-bold mb-6 leading-tight'>Build Something Amazing</h1><p class='text-xl md:text-2xl mb-8 text-indigo-100'>Create beautiful, responsive websites with our powerful content management system.</p>",
                                "format": "html",
                            },
                        },
                        {
                            "type": "button",
                            "config": {
                                "text": "Get Started",
                                "url": "#features",
                                "style": "primary",
                                "size": "large",
                            },
                        },
                    ],
                },
                {
                    "name": "features",
                    "title": "Features Section",
                    "description": "Product features, benefits, or service highlights",
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
    template_name = "default_layouts/layouts/minimal.html"
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


@register_layout
class SidebarLayout(BaseLayout):
    """Sidebar layout matching sidebar_layout.html template"""

    name = "sidebar_layout"
    description = (
        "Sidebar layout with header, main content, multi-section sidebar, and footer"
    )
    template_name = "default_layouts/layouts/sidebar_layout.html"
    css_classes = "layout-sidebar"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Page Header",
                    "description": "Site navigation, branding, and header content",
                    "max_widgets": 3,
                    "css_classes": "slot-header",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "Header: Logo, Navigation Menu, Search",
                                "style": "placeholder",
                            },
                        }
                    ],
                },
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area for articles, posts, and main page content",
                    "max_widgets": None,
                    "css_classes": "slot-main",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "Main Content: Articles, Blog Posts, Page Content, Images",
                                "style": "placeholder",
                            },
                        }
                    ],
                },
                {
                    "name": "sidebar-top",
                    "title": "Sidebar Top",
                    "description": "Top sidebar widgets like recent posts, categories, or featured content",
                    "max_widgets": 3,
                    "css_classes": "slot-sidebar-top",
                    "default_widgets": [
                        {
                            "type": "recent_posts",
                            "config": {"count": 5, "show_date": True},
                        }
                    ],
                },
                {
                    "name": "sidebar-middle",
                    "title": "Sidebar Middle",
                    "description": "Middle sidebar area for ads, social media, or related content",
                    "max_widgets": 4,
                    "css_classes": "slot-sidebar-middle",
                    "default_widgets": [
                        {
                            "type": "social_media",
                            "config": {
                                "platforms": ["twitter", "facebook", "linkedin"]
                            },
                        }
                    ],
                },
                {
                    "name": "sidebar-bottom",
                    "title": "Sidebar Bottom",
                    "description": "Bottom sidebar widgets for archives, tags, or supplementary content",
                    "max_widgets": 3,
                    "css_classes": "slot-sidebar-bottom",
                    "default_widgets": [
                        {"type": "tag_cloud", "config": {"max_tags": 20}},
                        {
                            "type": "newsletter",
                            "config": {"title": "Subscribe to Updates"},
                        },
                    ],
                },
                {
                    "name": "footer",
                    "title": "Footer",
                    "description": "Site footer with links, copyright, and contact information",
                    "max_widgets": 2,
                    "css_classes": "slot-footer",
                    "default_widgets": [
                        {
                            "type": "copyright",
                            "config": {"year": "2024", "company": "Your Company"},
                        },
                        {
                            "type": "footer_links",
                            "config": {"links": ["Privacy", "Terms", "Contact"]},
                        },
                    ],
                },
            ]
        }
