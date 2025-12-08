"""
Headline widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

logger = logging.getLogger(__name__)


class HeadlineConfig(BaseModel):
    """Configuration for Headline widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content: str = Field(
        "",
        description="Header text content",
        json_schema_extra={
            "component": "RichTextInput",
            "rows": 3,
            "order": 1,
            "group": "Content",
        },
    )
    headerLevel: str = Field(
        "h1",
        description="HTML header level",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "options": [
                {"value": "h1", "label": "H1"},
                {"value": "h2", "label": "H2"},
                {"value": "h3", "label": "H3"},
                {"value": "h4", "label": "H4"},
                {"value": "h5", "label": "H5"},
                {"value": "h6", "label": "H6"},
            ],
            "order": 1.5,
            "group": "Content",
        },
    )
    componentStyle: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 2,
            "group": "Styling",
        },
    )
    showBorder: bool = Field(
        True,
        description="Show widget border",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 3,
            "group": "Styling",
        },
    )
    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
            "order": 9999,
            "group": "Advanced",
        },
    )
    anchor_title: str = Field(
        "",
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Auto-generated from content",
            "helpText": "Displayed in navigation menus when linking to this content",
            "order": 10000,
            "group": "Advanced",
        },
    )


@register_widget_type
class HeadlineWidget(BaseWidget):
    """Headline widget for displaying header text"""

    name = "Headline"
    description = "Header text widget for page sections"
    template_name = "easy_widgets/widgets/headline.html"

    layout_parts = {
        "headline-widget": {
            "label": "Headline container",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
                "color",
                "fontFamily",
                "fontSize",
                "lineHeight",
            ],
        },
    }

    widget_css = """
    .headline-widget {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 140px;
        outline: 1px solid rgb(0,0,0,0.3);
        border-width: 0;
        overflow: hidden;
        margin-bottom: 30px;
    }
    .headline-widget.border-disabled {
        outline: none;
    }
    .headline-widget:last-child {
        margin-bottom: 0;
    }
    
    .headline-content {
        padding: 0;
        margin: 0;
    }
    
    /* Responsive behavior */
    @media (max-width: 768px) {
        .headline-content {
            padding: 20px;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeadlineConfig

    def render_with_style(self, config, theme):
        """
        Render headline with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) - always renders using template
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )

        style_name = config.get("component_style", "default")

        # For default style, return None to use standard Django template rendering
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)

        # If style not found in theme, fall back to default rendering
        if not style:
            return None

        template_str = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template_str.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Prepare context with all widget data
        context = prepare_component_context(
            content=config.get("content", ""),
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control (includes header_level)
        )

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions.
        """
        template_config = config.copy() if config else {}

        # Ensure snake_case fields for template
        template_config["component_style"] = config.get("component_style", "default")
        template_config["show_border"] = config.get("show_border", True)
        template_config["header_level"] = config.get("header_level", "h1")

        return template_config
