"""
Sidebar widget implementation.
"""

from typing import Any, Dict, List, Literal, Optional, Type

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


class LayoutWidgetConfig(BaseModel):
    """Base configuration for layout widgets (Footer, Header, Navigation, Sidebar)"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content: str = Field(..., description="Widget content (HTML)")
    background_color: Optional[str] = Field(None, description="Background color (hex or CSS color)")
    background_image: Optional[str] = Field(None, description="Background image URL")
    background_size: Literal["cover", "contain", "auto"] = Field("cover", description="Background image size")
    background_position: Literal["center", "top", "bottom", "left", "right"] = Field(
        "center", description="Background image position"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    padding: Optional[str] = Field(None, description="Widget padding (CSS value)")
    margin: Optional[str] = Field(None, description="Widget margin (CSS value)")
    text_align: Literal["left", "center", "right", "justify"] = Field("left", description="Text alignment")
    css_class: Optional[str] = Field(None, description="Additional CSS class")
    custom_css: Optional[str] = Field(None, description="Custom CSS for this widget")


class SidebarConfig(LayoutWidgetConfig):
    """Configuration for Sidebar widget"""

    position: Literal["left", "right"] = Field(
        "right",
        description="Sidebar position",
        json_schema_extra={"group": "Layout"},
    )
    width: Optional[str] = Field(
        None,
        description="Sidebar width (CSS value)",
        json_schema_extra={"group": "Layout"},
    )
    collapsible: bool = Field(False, description="Make sidebar collapsible")
    widgets: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Nested widgets in sidebar sections",
        json_schema_extra={"group": "Content"},
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
@catalog_widget
class SidebarWidget(BaseWidget):
    """Sidebar widget with background and text styling options"""

    description = "Sidebar widget with background image/color and text color options"
    template_name = "easy_widgets/widgets/sidebar.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SidebarConfig

    @classmethod
    def get_slot_definitions(cls):
        """Define slots for Sidebar widget"""
        return {
            "content": {
                "name": "content",
                "title": "Sidebar Content",
                "description": "Main content slot for the sidebar",
            }
        }

    def render_with_style(self, config, theme):
        """
        Render sidebar with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from django.template.loader import render_to_string

        from webpages.utils.mustache_renderer import prepare_component_context, render_mustache

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        # Render the sidebar HTML using the default template first
        sidebar_html = render_to_string(self.template_name, {"config": config})

        # Prepare context with rendered sidebar as content
        context = prepare_component_context(
            content=sidebar_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
