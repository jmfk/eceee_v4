"""
Example custom widgets for site-specific functionality.

This demonstrates how to create custom widgets in separate Django apps.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, HttpUrl
from webpages.widget_registry import BaseWidget, register_widget_type


class TestimonialConfig(BaseModel):
    """Configuration for Testimonial widget"""
    
    quote: str = Field(..., description="The testimonial quote")
    author: str = Field(..., description="Name of the person giving the testimonial")
    title: Optional[str] = Field(None, description="Job title or description")
    company: Optional[str] = Field(None, description="Company name")
    photo: Optional[HttpUrl] = Field(None, description="URL to author's photo")
    rating: Optional[int] = Field(None, ge=1, le=5, description="Star rating (1-5)")


class CallToActionConfig(BaseModel):
    """Configuration for Call to Action widget"""
    
    headline: str = Field(..., description="Main headline text")
    subtext: Optional[str] = Field(None, description="Supporting text")
    button_text: str = Field("Learn More", description="Button text")
    button_url: HttpUrl = Field(..., description="Button destination URL")
    background_color: str = Field("#f8f9fa", description="Background color (hex)")
    text_color: str = Field("#212529", description="Text color (hex)")


@register_widget_type
class TestimonialWidget(BaseWidget):
    """Customer testimonial widget with photo and rating"""
    
    name = "Testimonial"
    description = "Customer testimonial with photo, rating, and company details"
    template_name = "example_custom_widgets/testimonial.html"
    
    # Custom CSS for this widget
    widget_css = """
    .testimonial-widget {
        background: var(--testimonial-bg, #f8f9fa);
        border-radius: var(--testimonial-radius, 0.5rem);
        padding: var(--testimonial-padding, 1.5rem);
        box-shadow: var(--testimonial-shadow, 0 2px 4px rgba(0,0,0,0.1));
    }
    
    .testimonial-quote {
        font-style: italic;
        font-size: var(--quote-size, 1.125rem);
        line-height: var(--quote-line-height, 1.6);
        margin-bottom: 1rem;
        color: var(--quote-color, #374151);
    }
    
    .testimonial-author {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .testimonial-photo {
        width: var(--photo-size, 48px);
        height: var(--photo-size, 48px);
        border-radius: 50%;
        object-fit: cover;
    }
    
    .testimonial-details .name {
        font-weight: 600;
        color: var(--author-color, #111827);
    }
    
    .testimonial-details .title {
        color: var(--title-color, #6b7280);
        font-size: 0.875rem;
    }
    
    .testimonial-rating {
        color: var(--rating-color, #fbbf24);
        margin-top: 0.5rem;
    }
    """
    
    css_variables = {
        "testimonial-bg": "#f8f9fa",
        "testimonial-radius": "0.5rem",
        "testimonial-padding": "1.5rem",
        "quote-size": "1.125rem",
        "photo-size": "48px",
        "rating-color": "#fbbf24",
    }
    
    css_scope = "widget"
    
    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TestimonialConfig


@register_widget_type
class CallToActionWidget(BaseWidget):
    """Call to action banner with customizable styling"""
    
    name = "Call to Action"
    description = "Eye-catching call to action banner with customizable colors"
    template_name = "example_custom_widgets/call_to_action.html"
    
    widget_css = """
    .cta-widget {
        text-align: center;
        padding: var(--cta-padding, 3rem 2rem);
        border-radius: var(--cta-radius, 0.75rem);
        margin: var(--cta-margin, 2rem 0);
    }
    
    .cta-headline {
        font-size: var(--cta-headline-size, 2rem);
        font-weight: var(--cta-headline-weight, 700);
        margin-bottom: 1rem;
        line-height: 1.2;
    }
    
    .cta-subtext {
        font-size: var(--cta-subtext-size, 1.125rem);
        margin-bottom: 2rem;
        opacity: 0.9;
        line-height: 1.6;
    }
    
    .cta-button {
        display: inline-block;
        padding: var(--cta-button-padding, 0.75rem 2rem);
        background: var(--cta-button-bg, rgba(255,255,255,0.2));
        color: inherit;
        text-decoration: none;
        border-radius: var(--cta-button-radius, 0.5rem);
        font-weight: 600;
        transition: all 0.2s ease;
        border: 2px solid var(--cta-button-border, rgba(255,255,255,0.3));
    }
    
    .cta-button:hover {
        background: var(--cta-button-hover-bg, rgba(255,255,255,0.3));
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    """
    
    css_variables = {
        "cta-padding": "3rem 2rem",
        "cta-headline-size": "2rem",
        "cta-subtext-size": "1.125rem",
        "cta-button-padding": "0.75rem 2rem",
    }
    
    css_scope = "widget"
    
    @property
    def configuration_model(self) -> Type[BaseModel]:
        return CallToActionConfig