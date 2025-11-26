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
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
class FooterWidget(BaseWidget):
    """Footer widget with background and text styling options"""

    name = "Footer"
    description = "Footer widget with multi-column grid layout for links and content"
    template_name = "easy_widgets/widgets/footer.html"

    layout_parts = {
        "footer-widget": {
            "label": "Footer widget container",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
                "color",
            ],
        },
        "footer-content": {
            "label": "Footer content wrapper",
            "properties": [
                "maxWidth",
                "padding",
                "margin",
            ],
        },
        "footer-column": {
            "label": "Individual footer column",
            "properties": [
                "padding",
                "textAlign",
            ],
        },
        "footer-column-title": {
            "label": "Column title/heading",
            "properties": [
                "fontFamily",
                "fontSize",
                "fontWeight",
                "color",
                "margin",
            ],
        },
    }

    widget_css = """
    .footer-widget {
        box-sizing: border-box;
        background-color: #1f2937;
        color: #f9fafb;
        padding: 2rem 1rem;
        margin-top: auto;
        width: 100%;
    }
    
    .footer-content {
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .footer-columns {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
        margin-bottom: 2rem;
    }
    
    .footer-column {
        text-align: left;
    }
    
    .footer-column-title {
        color: inherit;
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }
    
    .footer-column-items {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .footer-column-item {
        margin-bottom: 0.5rem;
        line-height: 1.6;
    }
    
    .footer-column-item a {
        color: #60a5fa;
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .footer-column-item a:hover {
        color: #93c5fd;
        text-decoration: underline;
    }
    
    .footer-social-links,
    .footer-copyright {
        text-align: center;
        margin-top: 2rem;
    }
    
    .footer-social-link {
        display: inline-block;
        margin: 0 0.5rem;
        color: #60a5fa;
        transition: color 0.2s ease-in-out;
    }
    
    .footer-social-link:hover {
        color: #93c5fd;
    }
    
    /* Responsive design */
    @media (max-width: 1024px) {
        .footer-columns {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    @media (max-width: 640px) {
        .footer-columns {
            grid-template-columns: 1fr;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig

    def render_with_style(self, config, theme):
        """
        Render footer with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )
        from django.template.loader import render_to_string

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

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the footer HTML using the default template first
        footer_html = render_to_string(self.template_name, {"config": prepared_config, "widget_type": self})

        # Prepare context with rendered footer as content
        context = prepare_component_context(
            content=footer_html, 
            anchor="", 
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with snake_case field conversions and layout properties.
        """
        template_config = config.copy() if config else {}

        # Ensure snake_case fields for template
        template_config["column_count"] = config.get("column_count", 3)
        template_config["show_copyright"] = config.get("show_copyright", True)
        template_config["copyright_text"] = config.get("copyright_text", "")
        template_config["social_links"] = config.get("social_links", [])
        template_config["component_style"] = config.get("component_style", "default")

        # Extract layout properties from theme for dynamic sizing (similar to Banner/ContentCard)
        theme = context.get("theme") if context else None
        if theme and hasattr(theme, "design_groups"):
            design_groups = theme.design_groups or {}
            groups = design_groups.get("groups", [])

            # Find layout properties for footer parts
            for group in groups:
                layout_props = group.get("layoutProperties") or group.get(
                    "layout_properties", {}
                )
                
                # Extract properties for footer-widget (main container)
                if "footer-widget" in layout_props:
                    part_props = layout_props["footer-widget"]
                    # Note: Layout properties can be applied via CSS from design groups
                    # This is just for awareness - actual application happens in rendering
                
                # Could extract other footer parts if needed in the future

        return template_config
