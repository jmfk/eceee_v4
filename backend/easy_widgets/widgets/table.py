"""
Table widget implementation.
"""

from typing import List, Literal, Optional, Type

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


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

    media_id: Optional[int] = Field(None, description="Media library item ID")
    url: str = Field(..., description="Image URL")
    alt: Optional[str] = Field(None, description="Alt text for accessibility")


class TableCell(BaseModel):
    """Individual table cell configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content_type: Literal["text", "image"] = Field("text", description="Cell content type")
    content: str = Field("", description="Cell content (HTML for text cells)")
    image_data: Optional[CellImageData] = Field(None, description="Image data if cell type is image")
    colspan: int = Field(1, ge=1, description="Number of columns to span")
    rowspan: int = Field(1, ge=1, description="Number of rows to span")
    font_style: Literal["normal", "quote", "caption"] = Field("normal", description="Font style preset")
    alignment: Literal["left", "center", "right"] = Field("left", description="Text alignment")
    vertical_alignment: Literal["top", "middle", "bottom"] = Field("top", description="Vertical alignment")
    borders: Optional[BorderConfig] = Field(None, description="Per-side border configuration")
    background_color: Optional[str] = Field(None, description="Background color (hex or CSS color)")
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    hover_bg_color: Optional[str] = Field(None, description="Hover background color (hex or CSS color)")
    hover_text_color: Optional[str] = Field(None, description="Hover text color (hex or CSS color)")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableRow(BaseModel):
    """Table row configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    cells: List[TableCell] = Field(..., description="List of cells in this row")
    height: Optional[str] = Field(None, description="Row height (CSS value: auto, 50px, 3rem)")
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
    column_widths: List[str] = Field(default_factory=list, description="Column widths (CSS values: auto, 200px, 30%)")
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
@catalog_widget
class TableWidget(BaseWidget):
    """Table widget with configurable columns and rows"""

    description = "Advanced table widget with cell merging, images, styling, and responsive design"
    template_name = "easy_widgets/widgets/table.html"
    special_editor = "TableSpecialEditor"
    hide_config_form_fields = True  # Use special editor exclusively

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TableConfig

    def prepare_template_context(self, config, context=None):
        """Normalize editor/API camelCase config for the Django template."""
        template_config = super().prepare_template_context(config, context)
        try:
            normalized = TableConfig(**config).model_dump()
        except Exception:
            return template_config
        normalized["use_content_margins"] = normalized.pop("useContentMargins", False)
        normalized["variant_classes"] = template_config.get("variant_classes", "")
        if "_context" in template_config:
            normalized["_context"] = template_config["_context"]
        return normalized

    def render_with_style(self, config, theme):
        """
        Render table with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from django.template.loader import render_to_string

        from webpages.utils.mustache_renderer import (
            prepare_component_context,
            render_mustache,
        )

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
