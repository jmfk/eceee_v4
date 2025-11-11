"""
Widget configuration examples for Quick Reference.

Provides basic and advanced configuration examples for all easy_widgets.
Examples use camelCase for frontend compatibility.
"""

# Content Widget Examples
CONTENT_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "content": "<p>Simple paragraph with text content.</p>",
            "anchor": "",
            "componentStyle": "default"
        },
        "description": "Basic content with simple HTML paragraph"
    },
    "advanced": {
        "config": {
            "content": """<h2>Rich Content Example</h2>
<p>This content includes <strong>bold text</strong>, <em>italic text</em>, and <a href="#">links</a>.</p>
<ul>
  <li>Bullet point one</li>
  <li>Bullet point two</li>
</ul>
<blockquote>A quote from someone important.</blockquote>""",
            "anchor": "content-section",
            "allowScripts": False,
            "sanitizeHtml": True,
            "enableLightbox": True,
            "lightboxStyle": "modern",
            "lightboxGroup": "content-gallery",
            "componentStyle": "card"
        },
        "description": "Advanced content with rich HTML, lightbox support, and custom styling"
    }
}

# Hero Widget Examples
HERO_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "header": "Welcome to Our Website",
            "beforeText": None,
            "afterText": None,
            "image": None,
            "textColor": "#ffffff",
            "decorColor": "#cccccc",
            "backgroundColor": "#1f2937",
            "componentStyle": "default"
        },
        "description": "Simple hero with header text and background color"
    },
    "advanced": {
        "config": {
            "header": "Welcome to the Future",
            "beforeText": "Innovation starts here",
            "afterText": "Join us on this journey to transform the industry",
            "image": {
                "id": "123",
                "url": "/media/hero-background.jpg",
                "imgproxyBaseUrl": "/media/hero-background.jpg"
            },
            "textColor": "#ffffff",
            "decorColor": "#60a5fa",
            "backgroundColor": "#1e40af",
            "componentStyle": "gradient-overlay"
        },
        "description": "Full-featured hero with before/after text, background image, and custom styling"
    }
}

# Image Widget Examples
IMAGE_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "anchor": "",
            "mediaItems": [
                {
                    "id": "456",
                    "url": "/media/sample-image.jpg",
                    "type": "image",
                    "altText": "Sample image description",
                    "caption": "",
                    "title": "Sample Image"
                }
            ],
            "imageStyle": None,
            "enableLightbox": True,
            "showCaptions": False
        },
        "description": "Single image with lightbox enabled"
    },
    "advanced": {
        "config": {
            "anchor": "photo-gallery",
            "mediaItems": [
                {
                    "id": "789",
                    "url": "/media/photo-1.jpg",
                    "type": "image",
                    "altText": "First photo",
                    "caption": "Caption for first photo",
                    "title": "Photo One",
                    "photographer": "John Doe"
                },
                {
                    "id": "790",
                    "url": "/media/photo-2.jpg",
                    "type": "image",
                    "altText": "Second photo",
                    "caption": "Caption for second photo",
                    "title": "Photo Two",
                    "photographer": "Jane Smith"
                }
            ],
            "imageStyle": "modern-grid",
            "enableLightbox": True,
            "showCaptions": True,
            "lightboxGroup": "gallery-photos",
            "randomize": False,
            "imgproxyOverride": {
                "width": 800,
                "height": 600,
                "resizeType": "fill"
            }
        },
        "description": "Gallery with multiple images, captions, custom style, and imgproxy settings"
    }
}

# Table Widget Examples
TABLE_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "rows": [
                {
                    "cells": [
                        {"contentType": "text", "content": "Header 1", "fontStyle": "normal", "alignment": "left"},
                        {"contentType": "text", "content": "Header 2", "fontStyle": "normal", "alignment": "left"}
                    ],
                    "isHeader": True
                },
                {
                    "cells": [
                        {"contentType": "text", "content": "Cell 1", "fontStyle": "normal", "alignment": "left"},
                        {"contentType": "text", "content": "Cell 2", "fontStyle": "normal", "alignment": "left"}
                    ],
                    "isHeader": False
                }
            ],
            "columnWidths": ["auto", "auto"],
            "caption": None,
            "showBorders": True,
            "stripedRows": False,
            "hoverEffect": True,
            "responsive": True,
            "tableWidth": "full",
            "componentStyle": "default"
        },
        "description": "Simple 2-column table with headers"
    },
    "advanced": {
        "config": {
            "rows": [
                {
                    "cells": [
                        {"contentType": "text", "content": "Product", "fontStyle": "normal", "alignment": "left", "backgroundColor": "#f3f4f6"},
                        {"contentType": "text", "content": "Price", "fontStyle": "normal", "alignment": "right", "backgroundColor": "#f3f4f6"},
                        {"contentType": "text", "content": "Stock", "fontStyle": "normal", "alignment": "center", "backgroundColor": "#f3f4f6"}
                    ],
                    "isHeader": True,
                    "backgroundColor": "#e5e7eb"
                },
                {
                    "cells": [
                        {"contentType": "text", "content": "Widget A", "fontStyle": "normal", "alignment": "left"},
                        {"contentType": "text", "content": "$29.99", "fontStyle": "normal", "alignment": "right"},
                        {"contentType": "text", "content": "In Stock", "fontStyle": "caption", "alignment": "center", "textColor": "#059669"}
                    ],
                    "isHeader": False
                },
                {
                    "cells": [
                        {"contentType": "text", "content": "Widget B", "fontStyle": "normal", "alignment": "left"},
                        {"contentType": "text", "content": "$49.99", "fontStyle": "normal", "alignment": "right"},
                        {"contentType": "text", "content": "Out of Stock", "fontStyle": "caption", "alignment": "center", "textColor": "#dc2626"}
                    ],
                    "isHeader": False
                }
            ],
            "columnWidths": ["50%", "25%", "25%"],
            "caption": "Product Inventory",
            "showBorders": True,
            "stripedRows": True,
            "hoverEffect": True,
            "responsive": True,
            "tableWidth": "full",
            "componentStyle": "modern-table"
        },
        "description": "Advanced table with custom colors, alignment, striped rows, and caption"
    }
}

# Navbar Widget Examples
NAVBAR_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "menuItems": [
                {"label": "Home", "url": "/", "isActive": True, "targetBlank": False, "order": 0},
                {"label": "About", "url": "/about", "isActive": True, "targetBlank": False, "order": 1},
                {"label": "Contact", "url": "/contact", "isActive": True, "targetBlank": False, "order": 2}
            ],
            "secondaryMenuItems": [],
            "backgroundImage": None,
            "backgroundAlignment": "center",
            "backgroundColor": "#3b82f6",
            "hamburgerBreakpoint": 768,
            "componentStyle": "default"
        },
        "description": "Simple navbar with three menu items and background color"
    },
    "advanced": {
        "config": {
            "menuItems": [
                {"label": "Home", "url": "/", "isActive": True, "targetBlank": False, "order": 0},
                {"label": "Products", "url": "/products", "isActive": True, "targetBlank": False, "order": 1},
                {"label": "Services", "url": "/services", "isActive": True, "targetBlank": False, "order": 2},
                {"label": "Blog", "url": "/blog", "isActive": True, "targetBlank": False, "order": 3}
            ],
            "secondaryMenuItems": [
                {
                    "label": "Login",
                    "url": "/login",
                    "isActive": True,
                    "targetBlank": False,
                    "backgroundColor": "#10b981",
                    "backgroundImage": None,
                    "order": 0
                },
                {
                    "label": "Sign Up",
                    "url": "/signup",
                    "isActive": True,
                    "targetBlank": False,
                    "backgroundColor": "#f59e0b",
                    "backgroundImage": None,
                    "order": 1
                }
            ],
            "backgroundImage": {
                "id": "999",
                "url": "/media/navbar-bg.jpg",
                "imgproxyBaseUrl": "/media/navbar-bg.jpg"
            },
            "backgroundAlignment": "left",
            "backgroundColor": "#1e40af",
            "hamburgerBreakpoint": 1024,
            "componentStyle": "gradient-nav"
        },
        "description": "Full-featured navbar with primary/secondary menus, background image, and custom breakpoint"
    }
}

# Footer Widget Examples
FOOTER_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "columns": [
                {
                    "title": "Quick Links",
                    "items": [
                        {"label": "Home", "url": "/", "openInNewTab": False},
                        {"label": "About", "url": "/about", "openInNewTab": False}
                    ]
                }
            ],
            "columnCount": 1,
            "showCopyright": True,
            "copyrightText": "© 2025 Company Name. All rights reserved.",
            "socialLinks": [],
            "backgroundColor": "#1f2937",
            "textColor": "#f9fafb",
            "componentStyle": "default"
        },
        "description": "Simple footer with one column and copyright"
    },
    "advanced": {
        "config": {
            "columns": [
                {
                    "title": "Company",
                    "items": [
                        {"label": "About Us", "url": "/about", "openInNewTab": False},
                        {"label": "Careers", "url": "/careers", "openInNewTab": False},
                        {"label": "Press", "url": "/press", "openInNewTab": False}
                    ]
                },
                {
                    "title": "Products",
                    "items": [
                        {"label": "Features", "url": "/features", "openInNewTab": False},
                        {"label": "Pricing", "url": "/pricing", "openInNewTab": False},
                        {"label": "Testimonials", "url": "/testimonials", "openInNewTab": False}
                    ]
                },
                {
                    "title": "Resources",
                    "items": [
                        {"label": "Blog", "url": "/blog", "openInNewTab": False},
                        {"label": "Documentation", "url": "/docs", "openInNewTab": False},
                        {"label": "Support", "url": "/support", "openInNewTab": False}
                    ]
                }
            ],
            "columnCount": 3,
            "showCopyright": True,
            "copyrightText": "© 2025 Company Name. All rights reserved.",
            "socialLinks": [
                {"name": "Facebook", "url": "https://facebook.com/company", "icon": "fab fa-facebook"},
                {"name": "Twitter", "url": "https://twitter.com/company", "icon": "fab fa-twitter"},
                {"name": "LinkedIn", "url": "https://linkedin.com/company/company", "icon": "fab fa-linkedin"}
            ],
            "backgroundColor": "#111827",
            "textColor": "#f3f4f6",
            "backgroundImage": {
                "id": "888",
                "url": "/media/footer-bg.jpg",
                "imgproxyBaseUrl": "/media/footer-bg.jpg"
            },
            "backgroundSize": "cover",
            "backgroundPosition": "center",
            "padding": "3rem 1rem",
            "componentStyle": "premium-footer"
        },
        "description": "Multi-column footer with social links, background image, and custom styling"
    }
}

# Header Widget Examples
HEADER_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "image": {
                "id": "111",
                "url": "/media/logo.png",
                "imgproxyBaseUrl": "/media/logo.png"
            },
            "width": 1280,
            "height": 112,
            "alignment": "center",
            "mobileImage": None,
            "mobileWidth": 640,
            "mobileHeight": 80,
            "mobileAlignment": "center",
            "tabletImage": None,
            "tabletWidth": 1024,
            "tabletHeight": 112,
            "tabletAlignment": "center",
            "componentStyle": "default"
        },
        "description": "Simple header with single responsive image"
    },
    "advanced": {
        "config": {
            "image": {
                "id": "112",
                "url": "/media/header-desktop.jpg",
                "imgproxyBaseUrl": "/media/header-desktop.jpg"
            },
            "width": 1920,
            "height": 120,
            "alignment": "left",
            "mobileImage": {
                "id": "113",
                "url": "/media/header-mobile.jpg",
                "imgproxyBaseUrl": "/media/header-mobile.jpg"
            },
            "mobileWidth": 640,
            "mobileHeight": 60,
            "mobileAlignment": "center",
            "tabletImage": {
                "id": "114",
                "url": "/media/header-tablet.jpg",
                "imgproxyBaseUrl": "/media/header-tablet.jpg"
            },
            "tabletWidth": 1024,
            "tabletHeight": 100,
            "tabletAlignment": "center",
            "componentStyle": "parallax-header"
        },
        "description": "Fully responsive header with different images for mobile, tablet, and desktop"
    }
}

# Forms Widget Examples
FORMS_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "anchor": "",
            "title": "Contact Us",
            "description": "Send us a message and we'll get back to you soon.",
            "fields": [
                {
                    "name": "name",
                    "label": "Your Name",
                    "type": "text",
                    "required": True,
                    "placeholder": "John Doe"
                },
                {
                    "name": "email",
                    "label": "Email Address",
                    "type": "email",
                    "required": True,
                    "placeholder": "john@example.com"
                },
                {
                    "name": "message",
                    "label": "Message",
                    "type": "textarea",
                    "required": True,
                    "placeholder": "Your message here..."
                }
            ],
            "submitUrl": "/api/contact",
            "submitMethod": "POST",
            "successMessage": "Thank you for your message!",
            "submitButtonText": "Send Message",
            "ajaxSubmit": True,
            "componentStyle": "default"
        },
        "description": "Simple contact form with name, email, and message fields"
    },
    "advanced": {
        "config": {
            "anchor": "registration-form",
            "title": "Event Registration",
            "description": "Register for our upcoming conference",
            "fields": [
                {
                    "name": "firstName",
                    "label": "First Name",
                    "type": "text",
                    "required": True,
                    "placeholder": "John"
                },
                {
                    "name": "lastName",
                    "label": "Last Name",
                    "type": "text",
                    "required": True,
                    "placeholder": "Doe"
                },
                {
                    "name": "email",
                    "label": "Email",
                    "type": "email",
                    "required": True,
                    "placeholder": "john.doe@example.com",
                    "validation": {"pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"}
                },
                {
                    "name": "phone",
                    "label": "Phone Number",
                    "type": "phone",
                    "required": False,
                    "placeholder": "+1 (555) 123-4567"
                },
                {
                    "name": "attendanceType",
                    "label": "Attendance Type",
                    "type": "select",
                    "required": True,
                    "options": ["In-Person", "Virtual", "Hybrid"]
                },
                {
                    "name": "dietary",
                    "label": "Dietary Restrictions",
                    "type": "checkbox",
                    "required": False,
                    "options": ["Vegetarian", "Vegan", "Gluten-Free", "None"]
                },
                {
                    "name": "newsletter",
                    "label": "Subscribe to newsletter",
                    "type": "checkbox",
                    "required": False
                }
            ],
            "submitUrl": "/api/event/register",
            "submitMethod": "POST",
            "successMessage": "Registration successful! Check your email for details.",
            "errorMessage": "Registration failed. Please try again.",
            "submitButtonText": "Complete Registration",
            "resetButton": True,
            "ajaxSubmit": True,
            "redirectUrl": "/event/confirmation",
            "emailNotifications": True,
            "notificationEmail": "events@company.com",
            "storeSubmissions": True,
            "honeypotProtection": True,
            "recaptchaEnabled": True,
            "cssFramework": "tailwind",
            "componentStyle": "modern-form"
        },
        "description": "Complex registration form with validation, notifications, and advanced features"
    }
}

# Navigation Widget Examples
NAVIGATION_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "menus": {
                "activeGroup": "none",
                "formData": {}
            },
            "menuItems": [
                {"label": "Home", "url": "/", "isActive": True, "targetBlank": False},
                {"label": "About", "url": "/about", "isActive": True, "targetBlank": False},
                {"label": "Services", "url": "/services", "isActive": True, "targetBlank": False}
            ],
            "navigationStyle": None
        },
        "description": "Basic navigation with static menu items"
    },
    "advanced": {
        "config": {
            "menus": {
                "activeGroup": "pageSubmenu",
                "formData": {
                    "pageSubmenu": {
                        "childrenPreview": "Auto-generated from child pages"
                    }
                }
            },
            "menuItems": [
                {"label": "Overview", "url": "#overview", "isActive": True, "targetBlank": False},
                {"label": "External Link", "url": "https://example.com", "isActive": True, "targetBlank": True}
            ],
            "navigationStyle": "sidebar-nav"
        },
        "description": "Dynamic navigation with page submenu and component style"
    }
}

# Two Columns Widget Examples
TWO_COLUMNS_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "layoutStyle": None,
            "componentStyle": "default",
            "slots": {
                "left": [],
                "right": []
            }
        },
        "description": "Empty two-column layout container"
    },
    "advanced": {
        "config": {
            "layoutStyle": "60-40",
            "componentStyle": "modern-columns",
            "slots": {
                "left": [
                    {
                        "id": "widget-1",
                        "widgetType": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<h3>Left Column Content</h3><p>Main content goes here.</p>"
                        }
                    }
                ],
                "right": [
                    {
                        "id": "widget-2",
                        "widgetType": "easy_widgets.SidebarWidget",
                        "config": {
                            "content": "<h4>Sidebar</h4><p>Additional information.</p>"
                        }
                    }
                ]
            }
        },
        "description": "Two-column layout with custom ratio and nested widgets"
    }
}

# Three Columns Widget Examples
THREE_COLUMNS_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "componentStyle": "default",
            "slots": {
                "left": [],
                "center": [],
                "right": []
            }
        },
        "description": "Empty three-column layout container"
    },
    "advanced": {
        "config": {
            "componentStyle": "feature-grid",
            "slots": {
                "left": [
                    {
                        "id": "widget-3",
                        "widgetType": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<h4>Feature 1</h4><p>Description of first feature.</p>"
                        }
                    }
                ],
                "center": [
                    {
                        "id": "widget-4",
                        "widgetType": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<h4>Feature 2</h4><p>Description of second feature.</p>"
                        }
                    }
                ],
                "right": [
                    {
                        "id": "widget-5",
                        "widgetType": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<h4>Feature 3</h4><p>Description of third feature.</p>"
                        }
                    }
                ]
            }
        },
        "description": "Three-column feature grid with nested content widgets"
    }
}

# News List Widget Examples
NEWS_LIST_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "objectTypes": [1],  # News object type ID
            "limit": 10,
            "sortOrder": "-publish_date",
            "hideOnDetailView": False,
            "showExcerpts": True,
            "excerptLength": 150,
            "showFeaturedImage": True,
            "showPublishDate": True,
            "componentStyle": "default"
        },
        "description": "Simple news list showing latest 10 articles"
    },
    "advanced": {
        "config": {
            "objectTypes": [1, 2, 3],  # Multiple object types
            "limit": 20,
            "sortOrder": "-publish_date",
            "hideOnDetailView": True,
            "showExcerpts": True,
            "excerptLength": 200,
            "showFeaturedImage": True,
            "showPublishDate": True,
            "componentStyle": "card-grid"
        },
        "description": "Advanced news list with multiple object types, hidden on detail views, and card styling"
    }
}

# News Detail Widget Examples
NEWS_DETAIL_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "slugVariableName": "news_slug",
            "objectTypes": [1],
            "showMetadata": True,
            "showFeaturedImage": True,
            "showObjectType": False,
            "renderObjectWidgets": False,
            "componentStyle": "default"
        },
        "description": "Basic news detail view with metadata and featured image"
    },
    "advanced": {
        "config": {
            "slugVariableName": "article_slug",
            "objectTypes": [1, 2, 3],
            "showMetadata": True,
            "showFeaturedImage": True,
            "showObjectType": True,
            "renderObjectWidgets": True,
            "componentStyle": "article-layout"
        },
        "description": "Full-featured news detail with object widgets rendering and custom styling"
    }
}

# Sidebar Widget Examples
SIDEBAR_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "content": "<h3>Sidebar Title</h3><p>Sidebar content goes here.</p>",
            "backgroundColor": "#f9fafb",
            "textColor": "#1f2937",
            "position": "right",
            "componentStyle": "default"
        },
        "description": "Simple sidebar with content and styling"
    },
    "advanced": {
        "config": {
            "content": """<h3>Resources</h3>
<ul>
  <li><a href="/guide">Getting Started Guide</a></li>
  <li><a href="/api">API Documentation</a></li>
  <li><a href="/faq">FAQ</a></li>
</ul>""",
            "backgroundColor": "#ffffff",
            "backgroundImage": {
                "id": "777",
                "url": "/media/sidebar-bg.jpg",
                "imgproxyBaseUrl": "/media/sidebar-bg.jpg"
            },
            "backgroundSize": "cover",
            "backgroundPosition": "center",
            "textColor": "#1f2937",
            "padding": "2rem",
            "margin": "0 0 2rem 0",
            "textAlign": "left",
            "position": "right",
            "width": "300px",
            "collapsible": True,
            "cssClass": "custom-sidebar",
            "customCss": ".custom-sidebar a { color: #3b82f6; }",
            "componentStyle": "modern-sidebar"
        },
        "description": "Feature-rich sidebar with background image, custom CSS, and collapsible functionality"
    }
}

# Sidebar Top News Widget Examples
SIDEBAR_TOP_NEWS_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "objectTypes": ["news"],
            "limit": 5,
            "showThumbnails": True,
            "showDates": True,
            "showObjectType": False,
            "widgetTitle": "Top News",
            "componentStyle": "default"
        },
        "description": "Simple sidebar news list with thumbnails and dates"
    },
    "advanced": {
        "config": {
            "objectTypes": ["news", "articles", "updates"],
            "limit": 10,
            "showThumbnails": True,
            "showDates": True,
            "showObjectType": True,
            "widgetTitle": "Latest Updates",
            "componentStyle": "compact-list"
        },
        "description": "Multi-type sidebar news with object type badges and custom title"
    }
}

# Top News Plug Widget Examples
TOP_NEWS_PLUG_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "objectTypes": ["news"],
            "layout": "1x3",
            "showExcerpts": True,
            "excerptLength": 100,
            "showPublishDate": True,
            "showObjectType": False,
            "componentStyle": "default"
        },
        "description": "Three-column news grid for homepage"
    },
    "advanced": {
        "config": {
            "objectTypes": ["news", "featured"],
            "layout": "2x3_2",
            "showExcerpts": True,
            "excerptLength": 150,
            "showPublishDate": True,
            "showObjectType": True,
            "componentStyle": "featured-grid"
        },
        "description": "Complex grid layout with 3+2 arrangement and type badges"
    }
}

# Path Debug Widget Examples
PATH_DEBUG_WIDGET_EXAMPLES = {
    "basic": {
        "config": {
            "componentStyle": "default"
        },
        "description": "Debug widget showing path variables (development only)"
    },
    "advanced": {
        "config": {
            "componentStyle": "debug-panel"
        },
        "description": "Debug widget with custom styling (development only)"
    }
}

# Export all examples
WIDGET_EXAMPLES = {
    "easy_widgets.ContentWidget": CONTENT_WIDGET_EXAMPLES,
    "easy_widgets.HeroWidget": HERO_WIDGET_EXAMPLES,
    "easy_widgets.ImageWidget": IMAGE_WIDGET_EXAMPLES,
    "easy_widgets.TableWidget": TABLE_WIDGET_EXAMPLES,
    "easy_widgets.NavbarWidget": NAVBAR_WIDGET_EXAMPLES,
    "easy_widgets.FooterWidget": FOOTER_WIDGET_EXAMPLES,
    "easy_widgets.HeaderWidget": HEADER_WIDGET_EXAMPLES,
    "easy_widgets.FormsWidget": FORMS_WIDGET_EXAMPLES,
    "easy_widgets.NavigationWidget": NAVIGATION_WIDGET_EXAMPLES,
    "easy_widgets.TwoColumnsWidget": TWO_COLUMNS_WIDGET_EXAMPLES,
    "easy_widgets.ThreeColumnsWidget": THREE_COLUMNS_WIDGET_EXAMPLES,
    "easy_widgets.NewsListWidget": NEWS_LIST_WIDGET_EXAMPLES,
    "easy_widgets.NewsDetailWidget": NEWS_DETAIL_WIDGET_EXAMPLES,
    "easy_widgets.SidebarWidget": SIDEBAR_WIDGET_EXAMPLES,
    "easy_widgets.SidebarTopNewsWidget": SIDEBAR_TOP_NEWS_WIDGET_EXAMPLES,
    "easy_widgets.TopNewsPlugWidget": TOP_NEWS_PLUG_WIDGET_EXAMPLES,
    "easy_widgets.PathDebugWidget": PATH_DEBUG_WIDGET_EXAMPLES,
}


def get_widget_examples(widget_type: str) -> dict:
    """
    Get examples for a specific widget type.
    
    Args:
        widget_type: Widget type identifier (e.g., "easy_widgets.ContentWidget")
    
    Returns:
        Dictionary with "basic" and "advanced" examples, or empty dict if not found
    """
    return WIDGET_EXAMPLES.get(widget_type, {})


def get_all_widget_examples() -> dict:
    """
    Get all widget examples.
    
    Returns:
        Dictionary mapping widget types to their examples
    """
    return WIDGET_EXAMPLES

