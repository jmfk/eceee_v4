"""
Content widget implementation.
"""

from typing import Type
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class ContentConfig(BaseModel):
    """Configuration for Content widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    anchor: str = Field(
        "",
        description="Anchor Title",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
        },
    )

    content: str = Field(
        ...,
        description="HTML content to display",
        # Control specifications
        json_schema_extra={
            "component": "HtmlSource",
            "rows": 6,
        },
    )
    allow_scripts: bool = Field(
        False,
        description="WARNING: Only enable for trusted content",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "warning": True,
        },
    )
    sanitize_html: bool = Field(
        True,
        description="Sanitize HTML to prevent XSS attacks",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )


@register_widget_type
class ContentWidget(BaseWidget):
    """Content widget that contains HTML"""

    name = "Content"
    description = "Content widget that contains HTML"
    template_name = "easy_widgets/widgets/content.html"

    widget_css = """
    .content-widget {
        font-family: var(--content-font, inherit);
        line-height: var(--content-line-height, 1.6);
        color: var(--content-color, inherit);
    }
    
    .content-widget h1, .content-widget h2, .content-widget h3,
    .content-widget h4, .content-widget h5, .content-widget h6 {
        margin-top: var(--heading-margin-top, 1.5rem);
        margin-bottom: var(--heading-margin-bottom, 0.5rem);
        font-weight: var(--heading-font-weight, 600);
    }
    
    .content-widget p {
        margin-bottom: var(--paragraph-margin, 1rem);
    }
    
    .content-widget ul, .content-widget ol {
        margin-bottom: var(--list-margin, 1rem);
        padding-left: var(--list-padding, 1.5rem);
    }
    
    .content-widget blockquote {
        border-left: var(--blockquote-border, 4px solid #e5e7eb);
        padding-left: var(--blockquote-padding, 1rem);
        margin: var(--blockquote-margin, 1.5rem 0);
        font-style: italic;
        color: var(--blockquote-color, #6b7280);
    }
    
    .content-widget code {
        background-color: var(--code-bg, #f3f4f6);
        padding: var(--code-padding, 0.125rem 0.25rem);
        border-radius: var(--code-radius, 0.25rem);
        font-family: var(--code-font, monospace);
        font-size: var(--code-font-size, 0.875rem);
    }
    
    .content-widget pre {
        background-color: var(--pre-bg, #1f2937);
        color: var(--pre-color, #f9fafb);
        padding: var(--pre-padding, 1rem);
        border-radius: var(--pre-radius, 0.5rem);
        overflow-x: auto;
        margin: var(--pre-margin, 1.5rem 0);
    }
    
    .content-widget pre code {
        background-color: transparent;
        padding: 0;
        color: inherit;
    }
    """

    css_variables = {
        "content-font": "inherit",
        "content-line-height": "1.6",
        "content-color": "inherit",
        "heading-margin-top": "0",
        "heading-margin-bottom": "0.5rem",
        "heading-font-weight": "600",
        "paragraph-margin": "1rem",
        "list-margin": "1rem",
        "list-padding": "1.5rem",
        "blockquote-border": "4px solid #e5e7eb",
        "blockquote-padding": "1rem",
        "blockquote-margin": "1.5rem 0",
        "blockquote-color": "#6b7280",
        "code-bg": "#f3f4f6",
        "code-padding": "0.125rem 0.25rem",
        "code-radius": "0.25rem",
        "code-font": "monospace",
        "code-font-size": "0.875rem",
        "pre-bg": "#1f2937",
        "pre-color": "#f9fafb",
        "pre-padding": "1rem",
        "pre-radius": "0.5rem",
        "pre-margin": "1.5rem 0",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ContentConfig
