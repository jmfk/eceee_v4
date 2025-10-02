"""
Header widget implementation.
"""

from typing import Type, Optional, Literal
from pydantic import BaseModel, Field

from webpages.widget_registry import BaseWidget, register_widget_type


class LayoutWidgetConfig(BaseModel):
    """Base configuration for layout widgets (Footer, Header, Navigation, Sidebar)"""

    content: str = Field(
        ...,
        description="Widget content (HTML)",
        json_schema_extra={
            "component": "RichTextInput",
            "order": 1,
            "group": "Content",
        },
    )
    background_color: Optional[str] = Field(
        None,
        description="Background color (hex or CSS color)",
        json_schema_extra={
            "component": "ColorInput",
            "order": 1,
            "group": "Background",
        },
    )
    background_image: Optional[str] = Field(
        None,
        description="Background image URL",
        json_schema_extra={
            "component": "MediaInput",
            "order": 2,
            "group": "Background",
            "mediaTypes": ["image"],
        },
    )
    background_size: Literal["cover", "contain", "auto"] = Field(
        "cover",
        description="Background image size",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "order": 3,
            "group": "Background",
            "options": [
                {"value": "cover", "label": "Cover"},
                {"value": "contain", "label": "Contain"},
                {"value": "auto", "label": "Auto"},
            ],
        },
    )
    background_position: Literal["center", "top", "bottom", "left", "right"] = Field(
        "center",
        description="Background image position",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "order": 4,
            "group": "Background",
            "options": [
                {"value": "center", "label": "Center"},
                {"value": "top", "label": "Top"},
                {"value": "bottom", "label": "Bottom"},
                {"value": "left", "label": "Left"},
                {"value": "right", "label": "Right"},
            ],
        },
    )
    text_color: Optional[str] = Field(
        None,
        description="Text color (hex or CSS color)",
        json_schema_extra={
            "component": "ColorInput",
            "order": 1,
            "group": "Styling",
        },
    )
    padding: Optional[str] = Field(
        None,
        description="Widget padding (CSS value)",
        json_schema_extra={
            "component": "TextInput",
            "order": 2,
            "group": "Styling",
            "placeholder": "e.g., 2rem 1rem",
        },
    )
    margin: Optional[str] = Field(
        None,
        description="Widget margin (CSS value)",
        json_schema_extra={
            "component": "TextInput",
            "order": 3,
            "group": "Styling",
            "placeholder": "e.g., 1rem 0",
        },
    )
    text_align: Literal["left", "center", "right", "justify"] = Field(
        "left",
        description="Text alignment",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "order": 4,
            "group": "Styling",
            "options": [
                {"value": "left", "label": "Left"},
                {"value": "center", "label": "Center"},
                {"value": "right", "label": "Right"},
                {"value": "justify", "label": "Justify"},
            ],
        },
    )
    css_class: Optional[str] = Field(
        None,
        description="Additional CSS class",
        json_schema_extra={
            "component": "TextInput",
            "order": 1,
            "group": "Advanced",
            "placeholder": "custom-class",
        },
    )
    custom_css: Optional[str] = Field(
        None,
        description="Custom CSS for this widget",
        json_schema_extra={
            "component": "TextareaInput",
            "order": 2,
            "group": "Advanced",
            "rows": 5,
            "placeholder": ".header-widget { /* custom styles */ }",
        },
    )


class HeaderConfig(LayoutWidgetConfig):
    """Configuration for Header widget"""

    show_overlay: bool = Field(
        False,
        description="Show overlay on background image",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 5,
            "group": "Background",
        },
    )
    overlay_color: Optional[str] = Field(
        None,
        description="Overlay color",
        json_schema_extra={
            "component": "ColorInput",
            "order": 6,
            "group": "Background",
        },
    )
    overlay_opacity: float = Field(
        0.5,
        ge=0,
        le=1,
        description="Overlay opacity",
        json_schema_extra={
            "component": "SliderInput",
            "order": 7,
            "group": "Background",
            "min": 0,
            "max": 1,
            "step": 0.1,
            "showValue": True,
        },
    )
    hero_style: bool = Field(
        False,
        description="Use hero banner styling",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 5,
            "group": "Styling",
        },
    )
    min_height: Optional[str] = Field(
        None,
        description="Minimum height (CSS value)",
        json_schema_extra={
            "component": "TextInput",
            "order": 6,
            "group": "Styling",
            "placeholder": "e.g., 60vh or 400px",
        },
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Header widget with background and text styling options"""

    name = "Header"
    description = "Header widget with background image/color and text color options"
    template_name = "default_widgets/widgets/header.html"

    widget_css = """
    .header-widget {
        background-color: var(--header-bg-color, #ffffff);
        background-image: var(--header-bg-image, none);
        background-size: var(--header-bg-size, cover);
        background-position: var(--header-bg-position, center);
        background-repeat: var(--header-bg-repeat, no-repeat);
        color: var(--header-text-color, #1f2937);
        padding: var(--header-padding, 2rem 1rem);
        position: relative;
        overflow: hidden;
    }
    
    .header-widget .header-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--header-overlay-color, transparent);
        opacity: var(--header-overlay-opacity, 0.5);
    }
    
    .header-widget .header-content {
        position: relative;
        z-index: 1;
        max-width: var(--header-max-width, 1200px);
        margin: 0 auto;
        text-align: var(--header-text-align, center);
    }
    
    .header-widget h1 {
        font-size: var(--header-h1-size, 3rem);
        font-weight: var(--header-h1-weight, 700);
        margin-bottom: var(--header-h1-margin, 1rem);
        color: var(--header-h1-color, inherit);
        line-height: var(--header-h1-line-height, 1.2);
    }
    
    .header-widget h2 {
        font-size: var(--header-h2-size, 2rem);
        font-weight: var(--header-h2-weight, 600);
        margin-bottom: var(--header-h2-margin, 0.75rem);
        color: var(--header-h2-color, inherit);
    }
    
    .header-widget p {
        font-size: var(--header-p-size, 1.125rem);
        margin-bottom: var(--header-p-margin, 0.5rem);
        line-height: var(--header-line-height, 1.6);
    }
    
    .header-widget .subtitle {
        font-size: var(--header-subtitle-size, 1.25rem);
        color: var(--header-subtitle-color, inherit);
        opacity: var(--header-subtitle-opacity, 0.8);
    }
    
    @media (max-width: 768px) {
        .header-widget h1 {
            font-size: var(--header-h1-mobile-size, 2rem);
        }
        
        .header-widget {
            padding: var(--header-mobile-padding, 1.5rem 1rem);
        }
    }
    """

    css_variables = {
        "header-bg-color": "#ffffff",
        "header-bg-image": "none",
        "header-bg-size": "cover",
        "header-bg-position": "center",
        "header-bg-repeat": "no-repeat",
        "header-text-color": "#1f2937",
        "header-padding": "2rem 1rem",
        "header-overlay-color": "transparent",
        "header-overlay-opacity": "0.5",
        "header-max-width": "1200px",
        "header-text-align": "center",
        "header-h1-size": "3rem",
        "header-h1-weight": "700",
        "header-h1-margin": "1rem",
        "header-h1-color": "inherit",
        "header-h1-line-height": "1.2",
        "header-h2-size": "2rem",
        "header-h2-weight": "600",
        "header-h2-margin": "0.75rem",
        "header-h2-color": "inherit",
        "header-p-size": "1.125rem",
        "header-p-margin": "0.5rem",
        "header-line-height": "1.6",
        "header-subtitle-size": "1.25rem",
        "header-subtitle-color": "inherit",
        "header-subtitle-opacity": "0.8",
        "header-h1-mobile-size": "2rem",
        "header-mobile-padding": "1.5rem 1rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig
