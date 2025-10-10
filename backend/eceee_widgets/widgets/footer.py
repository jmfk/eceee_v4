"""
Footer widget implementation.
"""

from typing import Type, Optional, List, Literal, Dict
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


class FooterConfig(LayoutWidgetConfig):
    """Configuration for Footer widget"""

    show_copyright: bool = Field(True, description="Show copyright notice")
    copyright_text: Optional[str] = Field(None, description="Custom copyright text")
    social_links: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Social media links [{'name': 'Facebook', 'url': 'https://...', 'icon': 'fab fa-facebook'}]",
    )


@register_widget_type
class FooterWidget(BaseWidget):
    """Footer widget with background and text styling options"""

    name = "Footer"
    description = "Footer widget with background image/color and text color options"
    template_name = "eceee_widgets/widgets/footer.html"

    widget_css = """
    .footer-widget {
        background-color: var(--footer-bg-color, #1f2937);
        background-image: var(--footer-bg-image, none);
        background-size: var(--footer-bg-size, cover);
        background-position: var(--footer-bg-position, center);
        background-repeat: var(--footer-bg-repeat, no-repeat);
        color: var(--footer-text-color, #f9fafb);
        padding: var(--footer-padding, 2rem 1rem);
        margin-top: auto;
    }
    
    .footer-widget .footer-content {
        max-width: var(--footer-max-width, 1200px);
        margin: 0 auto;
        text-align: var(--footer-text-align, center);
    }
    
    .footer-widget h1, .footer-widget h2, .footer-widget h3,
    .footer-widget h4, .footer-widget h5, .footer-widget h6 {
        color: var(--footer-heading-color, inherit);
        margin-bottom: var(--footer-heading-margin, 1rem);
    }
    
    .footer-widget p {
        margin-bottom: var(--footer-paragraph-margin, 0.5rem);
        line-height: var(--footer-line-height, 1.6);
    }
    
    .footer-widget a {
        color: var(--footer-link-color, #60a5fa);
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .footer-widget a:hover {
        color: var(--footer-link-hover-color, #93c5fd);
        text-decoration: underline;
    }
    
    .footer-widget ul {
        list-style: var(--footer-list-style, none);
        padding: var(--footer-list-padding, 0);
        margin: var(--footer-list-margin, 0);
    }
    
    .footer-widget ul li {
        margin-bottom: var(--footer-list-item-margin, 0.5rem);
    }
    """

    css_variables = {
        "footer-bg-color": "#1f2937",
        "footer-bg-image": "none",
        "footer-bg-size": "cover",
        "footer-bg-position": "center",
        "footer-bg-repeat": "no-repeat",
        "footer-text-color": "#f9fafb",
        "footer-padding": "2rem 1rem",
        "footer-max-width": "1200px",
        "footer-text-align": "center",
        "footer-heading-color": "inherit",
        "footer-heading-margin": "1rem",
        "footer-paragraph-margin": "0.5rem",
        "footer-line-height": "1.6",
        "footer-link-color": "#60a5fa",
        "footer-link-hover-color": "#93c5fd",
        "footer-list-style": "none",
        "footer-list-padding": "0",
        "footer-list-margin": "0",
        "footer-list-item-margin": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig
