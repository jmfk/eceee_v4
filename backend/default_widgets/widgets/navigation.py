"""
Navigation widget implementation.
"""

from typing import Type
from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from ..widget_models import NavigationConfig


@register_widget_type
class NavigationWidget(BaseWidget):
    """Navigation widget with background and text styling options"""

    name = "Navigation"
    description = "Navigation widget with background image/color and text color options"
    template_name = "default_widgets/widgets/navigation.html"

    widget_css = """
    .navigation-widget {
        background-color: var(--nav-bg-color, #ffffff);
        background-image: var(--nav-bg-image, none);
        background-size: var(--nav-bg-size, cover);
        background-position: var(--nav-bg-position, center);
        background-repeat: var(--nav-bg-repeat, no-repeat);
        color: var(--nav-text-color, #1f2937);
        padding: var(--nav-padding, 1rem);
        border-bottom: var(--nav-border, 1px solid #e5e7eb);
    }
    
    .navigation-widget .nav-container {
        max-width: var(--nav-max-width, 1200px);
        margin: 0 auto;
        display: flex;
        justify-content: var(--nav-justify, space-between);
        align-items: center;
        flex-wrap: wrap;
    }
    
    .navigation-widget .nav-brand {
        font-size: var(--nav-brand-size, 1.5rem);
        font-weight: var(--nav-brand-weight, 700);
        color: var(--nav-brand-color, inherit);
        text-decoration: none;
    }
    
    .navigation-widget .nav-menu {
        display: flex;
        list-style: var(--nav-menu-list-style, none);
        margin: var(--nav-menu-margin, 0);
        padding: var(--nav-menu-padding, 0);
        gap: var(--nav-menu-gap, 2rem);
    }
    
    .navigation-widget .nav-menu a {
        color: var(--nav-link-color, inherit);
        text-decoration: none;
        font-weight: var(--nav-link-weight, 500);
        padding: var(--nav-link-padding, 0.5rem 1rem);
        border-radius: var(--nav-link-radius, 0.375rem);
        transition: all 0.2s ease-in-out;
    }
    
    .navigation-widget .nav-menu a:hover {
        background-color: var(--nav-link-hover-bg, #f3f4f6);
        color: var(--nav-link-hover-color, #1f2937);
    }
    
    .navigation-widget .nav-menu a.active {
        background-color: var(--nav-link-active-bg, #3b82f6);
        color: var(--nav-link-active-color, #ffffff);
    }
    
    .navigation-widget .nav-toggle {
        display: none;
        background: none;
        border: none;
        color: var(--nav-toggle-color, inherit);
        font-size: var(--nav-toggle-size, 1.5rem);
        cursor: pointer;
    }
    
    @media (max-width: 768px) {
        .navigation-widget .nav-menu {
            display: none;
            width: 100%;
            flex-direction: column;
            gap: var(--nav-mobile-gap, 0.5rem);
            margin-top: var(--nav-mobile-margin, 1rem);
        }
        
        .navigation-widget .nav-menu.active {
            display: flex;
        }
        
        .navigation-widget .nav-toggle {
            display: block;
        }
    }
    """

    css_variables = {
        "nav-bg-color": "#ffffff",
        "nav-bg-image": "none",
        "nav-bg-size": "cover",
        "nav-bg-position": "center",
        "nav-bg-repeat": "no-repeat",
        "nav-text-color": "#1f2937",
        "nav-padding": "1rem",
        "nav-border": "1px solid #e5e7eb",
        "nav-max-width": "1200px",
        "nav-justify": "space-between",
        "nav-brand-size": "1.5rem",
        "nav-brand-weight": "700",
        "nav-brand-color": "inherit",
        "nav-menu-list-style": "none",
        "nav-menu-margin": "0",
        "nav-menu-padding": "0",
        "nav-menu-gap": "2rem",
        "nav-link-color": "inherit",
        "nav-link-weight": "500",
        "nav-link-padding": "0.5rem 1rem",
        "nav-link-radius": "0.375rem",
        "nav-link-hover-bg": "#f3f4f6",
        "nav-link-hover-color": "#1f2937",
        "nav-link-active-bg": "#3b82f6",
        "nav-link-active-color": "#ffffff",
        "nav-toggle-color": "inherit",
        "nav-toggle-size": "1.5rem",
        "nav-mobile-gap": "0.5rem",
        "nav-mobile-margin": "1rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig
