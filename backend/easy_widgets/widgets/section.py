"""
Section widget implementation with collapsible functionality and anchor support.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.alias_generators import to_camel
from django.utils.text import slugify

from webpages.widget_registry import BaseWidget, register_widget_type


class SectionConfig(BaseModel):
    """Configuration for section widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    title: str = Field(
        "",
        description="Section title",
        json_schema_extra={
            "component": "TextInput",
            "order": 1,
            "group": "Content",
            "placeholder": "Enter section title...",
        },
    )

    enable_collapse: bool = Field(
        False,
        description="Enable collapsible functionality",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 4,
            "group": "Behavior",
        },
    )

    start_expanded: bool = Field(
        True,
        description="Start in expanded state",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 5,
            "group": "Behavior",
            "conditionalOn": {"field": "enable_collapse", "value": True},
        },
    )

    accordion_mode: bool = Field(
        False,
        description="Close other sections when opening (accordion behavior)",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 6,
            "group": "Behavior",
            "conditionalOn": {"field": "enable_collapse", "value": True},
            "helpText": "Only one section will be open at a time",
        },
    )

    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 7,
            "group": "Display Options",
        },
    )

    anchor: Optional[str] = Field(
        None,
        description="Anchor name for linking (auto-generated from title)",
        json_schema_extra={
            "component": "TextInput",
            "order": 9999,
            "group": "Advanced",
            "placeholder": "Auto-generated from title",
            "helpText": "Used for page navigation and deep linking",
        },
    )

    anchor_title: Optional[str] = Field(
        None,
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "order": 10000,
            "group": "Advanced",
            "placeholder": "Auto-generated from title",
            "helpText": "Displayed in navigation menus when linking to this section",
        },
    )


@register_widget_type
class SectionWidget(BaseWidget):
    """Section widget with collapsible functionality and internal slot"""

    app_label = "easy_widgets"
    name = "Section"
    description = "Collapsible section with anchor support and internal content slot"
    template_name = "easy_widgets/widgets/section.html"

    widget_css = """
    .section-widget {
        margin-bottom: 1.5rem;
        border-radius: 0.5rem;
    }
    
    .section-header {
        cursor: pointer;
        padding: 1rem;
        font-weight: 600;
        font-size: 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
    }
    
    .section-header.non-collapsible {
        cursor: default;
        padding-bottom: 0.5rem;
    }
    
    .section-toggle {
        transition: transform 0.2s ease;
        display: inline-block;
        margin-left: 0.5rem;
    }
    
    .section-toggle.expanded {
        transform: rotate(90deg);
    }
    
    .section-content {
        padding: 0 1rem 1rem 1rem;
        overflow: hidden;
        transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
    }
    
    .section-content.collapsed {
        max-height: 0 !important;
        opacity: 0;
        padding-top: 0;
        padding-bottom: 0;
    }
    
    .section-content.expanded {
        opacity: 1;
    }
    
    .widget-wrapper {
        margin-bottom: 0.75rem;
    }
    
    .widget-wrapper:last-child {
        margin-bottom: 0;
    }
    
    .empty-slot {
        color: #9ca3af;
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
        border: 2px dashed #e5e7eb;
        border-radius: 0.5rem;
        background-color: #f9fafb;
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SectionConfig

    def render_with_style(self, config, theme):
        """
        Render section widget with custom component style from theme.

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
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
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

        # Render the widget HTML using the default template first
        widget_html = render_to_string(self.template_name, {"config": prepared_config})

        # Prepare context with rendered widget as content
        context = prepare_component_context(
            content=widget_html,
            anchor=prepared_config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
            slots=prepared_config.get(
                "rendered_slots"
            ),  # Pass slot data for custom rendering
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def render(self, config, context=None):
        """Override render to skip rendering if section is empty"""
        # Get slots data
        slots_data = config.get("slots", {"content": []})
        content_widgets = slots_data.get("content", [])

        # If no content widgets, don't render the section at all
        if not content_widgets or len(content_widgets) == 0:
            return ""

        # Otherwise, use default rendering
        return super().render(config, context)

    def prepare_template_context(self, config, context=None):
        """Prepare context with slot rendering and anchor generation"""
        template_config = super().prepare_template_context(config, context)

        # Auto-generate anchor from title if not provided
        title = config.get("title", "")
        anchor = config.get("anchor")
        if title and not anchor:
            anchor = slugify(title)
            template_config["anchor"] = anchor

        # Get slots data (single 'content' slot)
        slots_data = config.get("slots", {"content": []})

        # Render widgets for the content slot using existing renderer
        rendered_slots = {}
        if context and "renderer" in context:
            content_widgets = slots_data.get("content", [])
            rendered_widgets = []
            for index, widget_data in enumerate(content_widgets):
                try:
                    # Add sort_order if missing (use array index to preserve order)
                    if "sort_order" not in widget_data and "order" not in widget_data:
                        widget_data = {**widget_data, "sort_order": index}

                    widget_html = context["renderer"].render_widget_json(
                        widget_data, context
                    )
                    rendered_widgets.append(
                        {"html": widget_html, "widget_data": widget_data}
                    )
                except Exception as e:
                    # Log error and continue
                    continue
            rendered_slots["content"] = rendered_widgets
        else:
            # Fallback: provide raw widget data for template
            rendered_slots = {
                "content": [
                    {"html": None, "widget_data": widget}
                    for widget in slots_data.get("content", [])
                ]
            }

        template_config.update(
            {"slots_data": slots_data, "rendered_slots": rendered_slots}
        )

        return template_config
