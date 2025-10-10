"""
Sidebar widget implementation.
"""

from typing import Type, Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class LayoutWidgetConfig(BaseModel):
    """Base configuration for layout widgets (Footer, Header, Navigation, Sidebar)"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content: str = Field(..., description="Widget content (HTML)")
    background_color: Optional[str] = Field(
        None, description="Background color (hex or CSS color)"
    )
    background_image: Optional[str] = Field(None, description="Background image URL")
    background_size: Literal["cover", "contain", "auto"] = Field(
        "cover", description="Background image size"
    )
    background_position: Literal["center", "top", "bottom", "left", "right"] = Field(
        "center", description="Background image position"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    padding: Optional[str] = Field(None, description="Widget padding (CSS value)")
    margin: Optional[str] = Field(None, description="Widget margin (CSS value)")
    text_align: Literal["left", "center", "right", "justify"] = Field(
        "left", description="Text alignment"
    )
    css_class: Optional[str] = Field(None, description="Additional CSS class")
    custom_css: Optional[str] = Field(None, description="Custom CSS for this widget")


class SidebarConfig(LayoutWidgetConfig):
    """Configuration for Sidebar widget"""

    position: Literal["left", "right"] = Field("right", description="Sidebar position")
    width: Optional[str] = Field(None, description="Sidebar width (CSS value)")
    collapsible: bool = Field(False, description="Make sidebar collapsible")
    widgets: List[Dict[str, Any]] = Field(
        default_factory=list, description="Nested widgets in sidebar sections"
    )


@register_widget_type
class SidebarWidget(BaseWidget):
    """Sidebar widget with background and text styling options"""

    name = "Sidebar"
    description = "Sidebar widget with background image/color and text color options"
    template_name = "default_widgets/widgets/sidebar.html"

    widget_css = """
    .sidebar-widget {
        background-color: var(--sidebar-bg-color, #f9fafb);
        background-image: var(--sidebar-bg-image, none);
        background-size: var(--sidebar-bg-size, cover);
        background-position: var(--sidebar-bg-position, center);
        background-repeat: var(--sidebar-bg-repeat, no-repeat);
        color: var(--sidebar-text-color, #1f2937);
        padding: var(--sidebar-padding, 1.5rem);
        border: var(--sidebar-border, 1px solid #e5e7eb);
        border-radius: var(--sidebar-radius, 0.5rem);
        height: fit-content;
    }
    
    .sidebar-widget .sidebar-section {
        margin-bottom: var(--sidebar-section-margin, 2rem);
    }
    
    .sidebar-widget .sidebar-section:last-child {
        margin-bottom: 0;
    }
    
    .sidebar-widget h1, .sidebar-widget h2, .sidebar-widget h3,
    .sidebar-widget h4, .sidebar-widget h5, .sidebar-widget h6 {
        color: var(--sidebar-heading-color, #1f2937);
        margin-bottom: var(--sidebar-heading-margin, 1rem);
        font-weight: var(--sidebar-heading-weight, 600);
        border-bottom: var(--sidebar-heading-border, 2px solid #e5e7eb);
        padding-bottom: var(--sidebar-heading-padding, 0.5rem);
    }
    
    .sidebar-widget p {
        margin-bottom: var(--sidebar-paragraph-margin, 1rem);
        line-height: var(--sidebar-line-height, 1.6);
        font-size: var(--sidebar-font-size, 0.875rem);
    }
    
    .sidebar-widget ul {
        list-style: var(--sidebar-list-style, none);
        padding: var(--sidebar-list-padding, 0);
        margin: var(--sidebar-list-margin, 0);
    }
    
    .sidebar-widget ul li {
        margin-bottom: var(--sidebar-list-item-margin, 0.75rem);
        padding-left: var(--sidebar-list-item-padding, 1rem);
        position: relative;
    }
    
    .sidebar-widget ul li:before {
        content: var(--sidebar-list-bullet, "•");
        color: var(--sidebar-list-bullet-color, #6b7280);
        position: absolute;
        left: 0;
        display: var(--sidebar-list-bullet-display, block);
    }
    
    .sidebar-widget a {
        color: var(--sidebar-link-color, #3b82f6);
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .sidebar-widget a:hover {
        color: var(--sidebar-link-hover-color, #2563eb);
        text-decoration: underline;
    }
    
    .sidebar-widget .sidebar-widget-list {
        background-color: var(--sidebar-widget-list-bg, #ffffff);
        border: var(--sidebar-widget-list-border, 1px solid #e5e7eb);
        border-radius: var(--sidebar-widget-list-radius, 0.375rem);
        padding: var(--sidebar-widget-list-padding, 1rem);
    }
    
    .sidebar-widget .sidebar-widget-list ul li {
        padding: var(--sidebar-widget-list-item-padding, 0.5rem 0);
        border-bottom: var(--sidebar-widget-list-item-border, 1px solid #f3f4f6);
    }
    
    .sidebar-widget .sidebar-widget-list ul li:last-child {
        border-bottom: none;
    }
    """

    css_variables = {
        "sidebar-bg-color": "#f9fafb",
        "sidebar-bg-image": "none",
        "sidebar-bg-size": "cover",
        "sidebar-bg-position": "center",
        "sidebar-bg-repeat": "no-repeat",
        "sidebar-text-color": "#1f2937",
        "sidebar-padding": "1.5rem",
        "sidebar-border": "1px solid #e5e7eb",
        "sidebar-radius": "0.5rem",
        "sidebar-section-margin": "2rem",
        "sidebar-heading-color": "#1f2937",
        "sidebar-heading-margin": "1rem",
        "sidebar-heading-weight": "600",
        "sidebar-heading-border": "2px solid #e5e7eb",
        "sidebar-heading-padding": "0.5rem",
        "sidebar-paragraph-margin": "1rem",
        "sidebar-line-height": "1.6",
        "sidebar-font-size": "0.875rem",
        "sidebar-list-style": "none",
        "sidebar-list-padding": "0",
        "sidebar-list-margin": "0",
        "sidebar-list-item-margin": "0.75rem",
        "sidebar-list-item-padding": "1rem",
        "sidebar-list-bullet": "•",
        "sidebar-list-bullet-color": "#6b7280",
        "sidebar-list-bullet-display": "block",
        "sidebar-link-color": "#3b82f6",
        "sidebar-link-hover-color": "#2563eb",
        "sidebar-widget-list-bg": "#ffffff",
        "sidebar-widget-list-border": "1px solid #e5e7eb",
        "sidebar-widget-list-radius": "0.375rem",
        "sidebar-widget-list-padding": "1rem",
        "sidebar-widget-list-item-padding": "0.5rem 0",
        "sidebar-widget-list-item-border": "1px solid #f3f4f6",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SidebarConfig
