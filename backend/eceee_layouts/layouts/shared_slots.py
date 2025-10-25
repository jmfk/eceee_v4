# Common slot definitions
header = {
    "name": "header",
    "title": "Header",
    "description": "Page header content",
    "max_widgets": 1,
    "css_classes": "header",
    "allows_inheritance": True,
    "allow_merge": False,
    "collapse_behavior": "any",  # Collapse if any inherited widgets present
    "default_widgets": [
        {
            "type": "header",
        },
    ],
    "inheritable_types": [
        "eceee_widgets.HeaderWidget"
    ],  # Only inherit navigation widgets
    "allowed_types": ["eceee_widgets.HeaderWidget"],
    "dimensions": {
        "mobile": {"width": 640, "height": None},
        "tablet": {"width": 1024, "height": None},
        "desktop": {"width": 1280, "height": None},
    },
}

navbar = {
    "name": "navbar",
    "title": "Navigation Bar",
    "description": "Main navigation menu",
    "max_widgets": 1,
    "css_classes": "navbar",
    "allows_inheritance": True,
    "allow_merge": False,
    "collapse_behavior": "any",  # Collapse if any inherited widgets present
    "default_widgets": [
        {
            "type": "navbar",
            "config": {
                "menu_items": [
                    {"label": "Home", "url": "/", "target_blank": False},
                    {"label": "News", "url": "/news/", "target_blank": False},
                    {"label": "About", "url": "/about/", "target_blank": False},
                ],
            },
        },
    ],
    "inheritable_types": ["eceee_widgets.NavbarWidget"],
    "allowed_types": ["eceee_widgets.NavbarWidget"],
    "dimensions": {
        "mobile": {"width": 640, "height": None},
        "tablet": {"width": 1024, "height": None},
        "desktop": {"width": 1280, "height": None},
    },
}

footer = {
    "name": "footer",
    "title": "Footer",
    "description": "Page footer content",
    "max_widgets": 1,
    "css_classes": "footer",
    "allows_inheritance": True,
    "allow_merge": False,
    "collapse_behavior": "any",  # Collapse if any inherited widgets present
    "default_widgets": [
        {
            "type": "footer",
        },
    ],
    "inheritable_types": [
        "eceee_widgets.FooterWidget"
    ],  # Only inherit navigation widgets
    "allowed_types": ["eceee_widgets.FooterWidget"],
    "dimensions": {
        "mobile": {"width": 640, "height": None},
        "tablet": {"width": 1024, "height": None},
        "desktop": {"width": 1280, "height": None},
    },
}
