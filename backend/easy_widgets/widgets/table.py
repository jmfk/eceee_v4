"""
Table widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class BorderStyle(BaseModel):
    """Border style configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    style: Literal["plain", "thick", "double"] = Field(
        "plain",
        description="Border style: plain (1px), thick (3px), double (1px double)",
    )
    color: Optional[str] = Field(None, description="Border color (hex or CSS color)")


class BorderConfig(BaseModel):
    """Per-side border configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    top: Optional[BorderStyle] = Field(None, description="Top border")
    bottom: Optional[BorderStyle] = Field(None, description="Bottom border")
    left: Optional[BorderStyle] = Field(None, description="Left border")
    right: Optional[BorderStyle] = Field(None, description="Right border")


class CellImageData(BaseModel):
    """Image data for image cells"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    media_id: int = Field(..., description="Media library item ID")
    url: str = Field(..., description="Image URL")
    alt: Optional[str] = Field(None, description="Alt text for accessibility")


class TableCell(BaseModel):
    """Individual table cell configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content_type: Literal["text", "image"] = Field(
        "text", description="Cell content type"
    )
    content: str = Field("", description="Cell content (HTML for text cells)")
    image_data: Optional[CellImageData] = Field(
        None, description="Image data if cell type is image"
    )
    colspan: int = Field(1, ge=1, description="Number of columns to span")
    rowspan: int = Field(1, ge=1, description="Number of rows to span")
    font_style: Literal["normal", "quote", "caption"] = Field(
        "normal", description="Font style preset"
    )
    alignment: Literal["left", "center", "right"] = Field(
        "left", description="Text alignment"
    )
    borders: Optional[BorderConfig] = Field(
        None, description="Per-side border configuration"
    )
    background_color: Optional[str] = Field(
        None, description="Background color (hex or CSS color)"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    hover_bg_color: Optional[str] = Field(
        None, description="Hover background color (hex or CSS color)"
    )
    hover_text_color: Optional[str] = Field(
        None, description="Hover text color (hex or CSS color)"
    )
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableRow(BaseModel):
    """Table row configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    cells: List[TableCell] = Field(..., description="List of cells in this row")
    height: Optional[str] = Field(
        None, description="Row height (CSS value: auto, 50px, 3rem)"
    )
    is_header: bool = Field(False, description="Whether this is a header row")
    background_color: Optional[str] = Field(None, description="Row background color")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableConfig(BaseModel):
    """Configuration for Table widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    rows: List[TableRow] = Field(..., min_items=1, description="Table rows")
    column_widths: List[str] = Field(
        default_factory=list, description="Column widths (CSS values: auto, 200px, 30%)"
    )
    caption: Optional[str] = Field(None, description="Table caption")
    show_borders: bool = Field(True, description="Show table borders")
    striped_rows: bool = Field(False, description="Alternate row colors")
    hover_effect: bool = Field(True, description="Highlight rows on hover")
    responsive: bool = Field(True, description="Make table responsive on mobile")
    table_width: Literal["auto", "full"] = Field("full", description="Table width")
    css_class: Optional[str] = Field(None, description="Additional CSS class for table")
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )
    useContentMargins: bool = Field(
        False,
        description="Use content margins (extra left/right padding on larger screens)",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "group": "Display Options",
        },
    )


@register_widget_type
class TableWidget(BaseWidget):
    """Table widget with configurable columns and rows"""

    name = "Table"
    description = "Advanced table widget with cell merging, images, styling, and responsive design"
    template_name = "easy_widgets/widgets/table.html"
    special_editor = "TableSpecialEditor"
    hide_config_form_fields = True  # Use special editor exclusively

    layout_parts = {
        "table-widget": {
            "label": "Table widget container",
            "selector": ".table-widget",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
            ],
        },
    }

    widget_css = """
    .table-widget {
        overflow-x: auto;
        margin-bottom: 30px;
    }
    .table-widget:last-child {
        margin-bottom: 0;
    }    
    
    .table-widget table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--table-font, inherit);
        background-color: var(--table-bg, transparent);
    }
    
    .table-widget th,
    .table-widget td {
        padding: var(--cell-padding, 0.75rem);
        border: var(--cell-border, 1px solid #d1d5db);
        text-align: var(--cell-alignment, left);
        vertical-align: var(--cell-vertical-alignment, top);
        transition: background-color 0.2s ease, color 0.2s ease;
    }
    
    .table-widget th {
        background-color: var(--header-bg, #f3f4f6);
        color: var(--header-color, #1f2937);
        font-weight: var(--header-font-weight, 600);
    }
    
    .table-widget td {
        background-color: var(--cell-bg, transparent);
        color: var(--cell-color, inherit);
    }
    
    /* Font style presets */
    .table-cell-quote {
        font-style: italic;
        padding-left: 1.5rem;
        border-left: 3px solid var(--quote-border-color, #d1d5db);
        color: var(--quote-color, #6b7280);
    }
    
    .table-cell-caption {
        font-size: 0.875rem;
        color: var(--caption-color, #6b7280);
        font-weight: 400;
    }
    
    /* Alignment classes */
    .table-widget .cell-center {
        text-align: center;
    }
    
    .table-widget .cell-right {
        text-align: right;
    }
    
    .table-widget .cell-left {
        text-align: left;
    }
    
    /* Image cells */
    .table-widget .cell-image {
        padding: 0.25rem;
    }
    
    .table-widget .cell-image img {
        max-width: 100%;
        height: auto;
        display: block;
    }
    
    /* Striped rows */
    .table-widget.table-striped tr:nth-child(even) td {
        background-color: var(--row-even-bg, #f9fafb);
    }
    
    /* Hover effect */
    .table-widget.table-hover tr:hover td {
        background-color: var(--row-hover-bg, #f3f4f6);
    }
    
    /* Responsive table */
    @media (max-width: 768px) {
        .table-widget.table-responsive {
            font-size: var(--mobile-font-size, 0.875rem);
        }
        
        .table-widget.table-responsive th,
        .table-widget.table-responsive td {
            padding: var(--mobile-cell-padding, 0.5rem);
        }
    }
    """

    css_variables = {
        "table-margin": "1rem 0",
        "table-font": "inherit",
        "table-bg": "transparent",
        "header-bg": "#f3f4f6",
        "header-color": "#1f2937",
        "header-font-weight": "600",
        "cell-padding": "0.75rem",
        "cell-border": "1px solid #d1d5db",
        "cell-alignment": "left",
        "cell-vertical-alignment": "top",
        "cell-bg": "transparent",
        "cell-color": "inherit",
        "row-even-bg": "#f9fafb",
        "row-hover-bg": "#f3f4f6",
        "quote-border-color": "#d1d5db",
        "quote-color": "#6b7280",
        "caption-color": "#6b7280",
        "mobile-font-size": "0.875rem",
        "mobile-cell-padding": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TableConfig

    def render_with_style(self, config, theme):
        """
        Render table with custom component style from theme.

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

        template = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Render the table HTML using the default template first
        table_html = render_to_string(self.template_name, {"config": config})

        # Prepare context with rendered table as content
        context = prepare_component_context(
            content=table_html,
            anchor=config.get("caption", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Render with style template
        html = render_mustache(template, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """Prepare template context with snake_case field conversions"""
        template_config = super().prepare_template_context(config, context)

        # Ensure snake_case fields for template
        template_config["use_content_margins"] = config.get(
            "use_content_margins", False
        )

        return template_config

    @staticmethod
    def get_default_config():
        """Return default configuration for a new table"""
        return {
            "rows": [
                {
                    "cells": [
                        {"contentType": "text", "content": ""},
                        {"contentType": "text", "content": ""},
                    ],
                    "height": None,
                },
                {
                    "cells": [
                        {"contentType": "text", "content": ""},
                        {"contentType": "text", "content": ""},
                    ],
                    "height": None,
                },
            ],
            "columnWidths": ["auto", "auto"],
            "caption": None,
            "showBorders": True,
            "stripedRows": False,
            "hoverEffect": True,
            "responsive": True,
            "tableWidth": "full",
        }
