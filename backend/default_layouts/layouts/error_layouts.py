"""
Error Layout Classes for HTTP Error Pages

These layouts are specifically designed for error pages (404, 500, etc.)
and provide a consistent user experience when errors occur.
"""

from webpages.layout_registry import BaseLayout, register_layout


@register_layout
class Error404Layout(BaseLayout):
    """Layout for 404 Not Found error pages"""

    name = "error_404"
    description = "Layout for 404 Not Found error pages with customizable content"
    template_name = "default_layouts/layouts/error_404.html"
    css_classes = "layout-error layout-error-404"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "branding",
                    "title": "Branding",
                    "description": "Site branding and logo area",
                    "max_widgets": 2,
                    "css_classes": "slot-branding",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
                {
                    "name": "error_message",
                    "title": "Error Message",
                    "description": "Main error message and explanation",
                    "max_widgets": 3,
                    "css_classes": "slot-error-message",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>404 - Page Not Found</h1><p>Sorry, the page you're looking for doesn't exist.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
                {
                    "name": "helpful_content",
                    "title": "Helpful Content",
                    "description": "Suggestions, links, and helpful information for users",
                    "max_widgets": None,
                    "css_classes": "slot-helpful-content",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>What can you do?</h2><ul><li>Check the URL for typos</li><li>Go back to the <a href='/'>homepage</a></li><li>Use the search feature</li></ul>",
                                "format": "html",
                            },
                        },
                    ],
                },
            ]
        }


@register_layout
class Error500Layout(BaseLayout):
    """Layout for 500 Internal Server Error pages"""

    name = "error_500"
    description = "Layout for 500 Internal Server Error pages"
    template_name = "default_layouts/layouts/error_500.html"
    css_classes = "layout-error layout-error-500"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "branding",
                    "title": "Branding",
                    "description": "Site branding and logo area",
                    "max_widgets": 2,
                    "css_classes": "slot-branding",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
                {
                    "name": "error_message",
                    "title": "Error Message",
                    "description": "Main error message and explanation",
                    "max_widgets": 3,
                    "css_classes": "slot-error-message",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>500 - Server Error</h1><p>Something went wrong on our end. We're working to fix it.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
                {
                    "name": "helpful_content",
                    "title": "Helpful Content",
                    "description": "Suggestions and helpful information for users",
                    "max_widgets": None,
                    "css_classes": "slot-helpful-content",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>What happened?</h2><p>Our team has been notified and is working to resolve the issue. Please try again later.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
            ]
        }


@register_layout
class Error403Layout(BaseLayout):
    """Layout for 403 Forbidden error pages"""

    name = "error_403"
    description = "Layout for 403 Forbidden error pages"
    template_name = "default_layouts/layouts/error_403.html"
    css_classes = "layout-error layout-error-403"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "branding",
                    "title": "Branding",
                    "description": "Site branding and logo area",
                    "max_widgets": 2,
                    "css_classes": "slot-branding",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
                {
                    "name": "error_message",
                    "title": "Error Message",
                    "description": "Main error message and explanation",
                    "max_widgets": 3,
                    "css_classes": "slot-error-message",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>403 - Access Forbidden</h1><p>You don't have permission to access this resource.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
                {
                    "name": "helpful_content",
                    "title": "Helpful Content",
                    "description": "Suggestions and helpful information for users",
                    "max_widgets": None,
                    "css_classes": "slot-helpful-content",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>What can you do?</h2><ul><li>Log in with appropriate credentials</li><li>Contact the site administrator</li><li>Go back to the <a href='/'>homepage</a></li></ul>",
                                "format": "html",
                            },
                        },
                    ],
                },
            ]
        }


@register_layout
class Error503Layout(BaseLayout):
    """Layout for 503 Service Unavailable error pages"""

    name = "error_503"
    description = "Layout for 503 Service Unavailable error pages"
    template_name = "default_layouts/layouts/error_503.html"
    css_classes = "layout-error layout-error-503"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "branding",
                    "title": "Branding",
                    "description": "Site branding and logo area",
                    "max_widgets": 2,
                    "css_classes": "slot-branding",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                },
                {
                    "name": "error_message",
                    "title": "Error Message",
                    "description": "Main error message and explanation",
                    "max_widgets": 3,
                    "css_classes": "slot-error-message",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>503 - Service Unavailable</h1><p>The service is temporarily unavailable. Please try again later.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
                {
                    "name": "helpful_content",
                    "title": "Helpful Content",
                    "description": "Suggestions and helpful information for users",
                    "max_widgets": None,
                    "css_classes": "slot-helpful-content",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},
                    },
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h2>What's happening?</h2><p>We're performing maintenance or experiencing high traffic. Please check back soon.</p>",
                                "format": "html",
                            },
                        },
                    ],
                },
            ]
        }
