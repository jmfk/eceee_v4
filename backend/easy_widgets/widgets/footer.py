"""
Footer widget implementation.
"""

from typing import Type, Optional, List, Literal, Dict
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class FooterItem(BaseModel):
    """Individual footer item (link or text)"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    label: str = Field(..., description="Text label for the item")
    url: Optional[str] = Field(None, description="Optional link URL")
    open_in_new_tab: bool = Field(
        False, description="Open link in new tab (if URL is provided)"
    )


class FooterColumn(BaseModel):
    """Footer column with title and items"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    title: Optional[str] = Field(None, description="Column heading")
    items: List[FooterItem] = Field(
        default_factory=list, description="List of items in this column"
    )


class LayoutWidgetConfig(BaseModel):
    """Base configuration for layout widgets (Footer, Header, Navigation, Sidebar)"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

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

    columns: List[FooterColumn] = Field(
        default_factory=lambda: [FooterColumn(), FooterColumn(), FooterColumn()],
        description="Footer columns with items",
    )
    column_count: int = Field(3, ge=1, le=6, description="Number of columns to display")
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
    description = "Footer widget with multi-column grid layout for links and content"
    template_name = "easy_widgets/widgets/footer.html"

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
    }
    
    .footer-widget .footer-columns {
        display: grid;
        grid-template-columns: repeat(var(--footer-column-count, 3), 1fr);
        gap: var(--footer-column-gap, 2rem);
        margin-bottom: var(--footer-section-margin, 2rem);
    }
    
    .footer-widget .footer-column {
        text-align: var(--footer-text-align, left);
    }
    
    .footer-widget .footer-column-title {
        color: var(--footer-heading-color, inherit);
        font-size: var(--footer-heading-size, 1.125rem);
        font-weight: var(--footer-heading-weight, 600);
        margin-bottom: var(--footer-heading-margin, 1rem);
    }
    
    .footer-widget .footer-column-items {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .footer-widget .footer-column-item {
        margin-bottom: var(--footer-list-item-margin, 0.5rem);
        line-height: var(--footer-line-height, 1.6);
    }
    
    .footer-widget .footer-column-item a {
        color: var(--footer-link-color, #60a5fa);
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .footer-widget .footer-column-item a:hover {
        color: var(--footer-link-hover-color, #93c5fd);
        text-decoration: underline;
    }
    
    .footer-widget .footer-social-links,
    .footer-widget .footer-copyright {
        text-align: center;
        margin-top: var(--footer-section-margin, 2rem);
    }
    
    .footer-widget .footer-social-link {
        display: inline-block;
        margin: 0 0.5rem;
        color: var(--footer-link-color, #60a5fa);
        transition: color 0.2s ease-in-out;
    }
    
    .footer-widget .footer-social-link:hover {
        color: var(--footer-link-hover-color, #93c5fd);
    }
    
    /* Responsive design */
    @media (max-width: 1024px) {
        .footer-widget .footer-columns {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    @media (max-width: 640px) {
        .footer-widget .footer-columns {
            grid-template-columns: 1fr;
        }
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
        "footer-column-count": "3",
        "footer-column-gap": "2rem",
        "footer-text-align": "left",
        "footer-heading-color": "inherit",
        "footer-heading-size": "1.125rem",
        "footer-heading-weight": "600",
        "footer-heading-margin": "1rem",
        "footer-section-margin": "2rem",
        "footer-line-height": "1.6",
        "footer-link-color": "#60a5fa",
        "footer-link-hover-color": "#93c5fd",
        "footer-list-item-margin": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig
