"""
Table widget implementation.
"""

from typing import Type, Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class TableCell(BaseModel):
    """Individual table cell configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    content: str = Field("", description="Cell content")
    colspan: int = Field(1, ge=1, description="Number of columns to span")
    rowspan: int = Field(1, ge=1, description="Number of rows to span")
    alignment: Literal["left", "center", "right"] = Field(
        "left", description="Text alignment"
    )
    background_color: Optional[str] = Field(
        None, description="Background color (hex or CSS color)"
    )
    text_color: Optional[str] = Field(None, description="Text color (hex or CSS color)")
    font_weight: Literal["normal", "bold"] = Field("normal", description="Font weight")
    font_style: Literal["normal", "italic"] = Field("normal", description="Font style")
    padding: Optional[str] = Field(None, description="Cell padding (CSS value)")
    border: Optional[str] = Field(None, description="Cell border (CSS value)")
    css_class: Optional[str] = Field(None, description="Additional CSS class")


class TableRow(BaseModel):
    """Table row configuration"""

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

    cells: List[TableCell] = Field(..., description="List of cells in this row")
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
    caption: Optional[str] = Field(None, description="Table caption")
    show_borders: bool = Field(True, description="Show table borders")
    striped_rows: bool = Field(True, description="Alternate row colors")
    hover_effect: bool = Field(True, description="Highlight rows on hover")
    responsive: bool = Field(True, description="Make table responsive on mobile")
    table_width: Literal["auto", "full"] = Field("full", description="Table width")
    css_class: Optional[str] = Field(None, description="Additional CSS class for table")


@register_widget_type
class TableWidget(BaseWidget):
    """Table widget with configurable columns and rows"""

    name = "Table"
    description = "Table widget with configurable columns and rows, cell styling, and spanning capabilities"
    template_name = "default_widgets/widgets/table.html"

    widget_css = """
    .table-widget {
        overflow-x: auto;
        margin: var(--table-margin, 1rem 0);
    }
    
    .table-widget table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--table-font, inherit);
        background-color: var(--table-bg, transparent);
    }
    
    .table-widget th {
        background-color: var(--header-bg, #f3f4f6);
        color: var(--header-color, #1f2937);
        font-weight: var(--header-font-weight, 600);
        text-align: var(--header-alignment, left);
        padding: var(--header-padding, 0.75rem);
        border: var(--header-border, 1px solid #d1d5db);
    }
    
    .table-widget td {
        padding: var(--cell-padding, 0.75rem);
        border: var(--cell-border, 1px solid #d1d5db);
        text-align: var(--cell-alignment, left);
        vertical-align: var(--cell-vertical-alignment, top);
        background-color: var(--cell-bg, transparent);
        color: var(--cell-color, inherit);
    }
    
    .table-widget tr:nth-child(even) td {
        background-color: var(--row-even-bg, #f9fafb);
    }
    
    .table-widget tr:hover td {
        background-color: var(--row-hover-bg, #f3f4f6);
    }
    
    .table-widget .cell-center {
        text-align: center;
    }
    
    .table-widget .cell-right {
        text-align: right;
    }
    
    .table-widget .cell-bold {
        font-weight: bold;
    }
    
    .table-widget .cell-italic {
        font-style: italic;
    }
    
    .table-widget .cell-highlight {
        background-color: var(--cell-highlight-bg, #fef3c7) !important;
    }
    
    .table-widget .cell-success {
        background-color: var(--cell-success-bg, #dcfce7) !important;
        color: var(--cell-success-color, #166534);
    }
    
    .table-widget .cell-warning {
        background-color: var(--cell-warning-bg, #fef3c7) !important;
        color: var(--cell-warning-color, #92400e);
    }
    
    .table-widget .cell-error {
        background-color: var(--cell-error-bg, #fee2e2) !important;
        color: var(--cell-error-color, #991b1b);
    }
    
    @media (max-width: 768px) {
        .table-widget {
            font-size: var(--mobile-font-size, 0.875rem);
        }
        
        .table-widget th,
        .table-widget td {
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
        "header-alignment": "left",
        "header-padding": "0.75rem",
        "header-border": "1px solid #d1d5db",
        "cell-padding": "0.75rem",
        "cell-border": "1px solid #d1d5db",
        "cell-alignment": "left",
        "cell-vertical-alignment": "top",
        "cell-bg": "transparent",
        "cell-color": "inherit",
        "row-even-bg": "#f9fafb",
        "row-hover-bg": "#f3f4f6",
        "cell-highlight-bg": "#fef3c7",
        "cell-success-bg": "#dcfce7",
        "cell-success-color": "#166534",
        "cell-warning-bg": "#fef3c7",
        "cell-warning-color": "#92400e",
        "cell-error-bg": "#fee2e2",
        "cell-error-color": "#991b1b",
        "mobile-font-size": "0.875rem",
        "mobile-cell-padding": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TableConfig
