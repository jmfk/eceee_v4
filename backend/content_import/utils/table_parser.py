"""HTML table parsing utilities for converting HTML tables to TableWidget format."""

import logging
from typing import Dict, Any, List
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)


def parse_html_table(html: str) -> Dict[str, Any]:
    """
    Parse HTML table markup into TableWidget structured format.

    Args:
        html: HTML string containing a table element

    Returns:
        Dict with TableWidget configuration (rows, columnWidths, etc.)

    Raises:
        ValueError: If no table found or table is invalid
    """
    if not html or not html.strip():
        raise ValueError("No HTML content provided")

    # Parse HTML
    soup = BeautifulSoup(html, "html.parser")

    # Find the first table element
    table = soup.find("table")
    if not table:
        raise ValueError("No table element found in HTML")

    # Extract table configuration
    show_borders = _extract_border_setting(table)
    rows = _extract_rows(table)

    if not rows:
        raise ValueError("No rows found in table")

    # Calculate max columns considering colspan
    max_cols = _calculate_max_columns(rows)

    # Generate column widths (all auto by default)
    column_widths = ["auto"] * max_cols

    return {
        "rows": rows,
        "columnWidths": column_widths,
        "caption": None,
        "showBorders": show_borders,
        "stripedRows": False,
        "hoverEffect": True,
        "responsive": True,
        "tableWidth": "full",
    }


def _extract_border_setting(table: Tag) -> bool:
    """
    Extract border setting from table element.

    Args:
        table: BeautifulSoup table element

    Returns:
        True if borders should be shown, False otherwise
    """
    border_attr = table.get("border")
    if border_attr in ("0", "none", ""):
        return False

    # Check for border in style attribute
    style = table.get("style", "")
    if "border" in style.lower() and "none" in style.lower():
        return False

    return True


def _extract_rows(table: Tag) -> List[Dict[str, Any]]:
    """
    Extract all rows from table (including thead and tbody).

    Args:
        table: BeautifulSoup table element

    Returns:
        List of row dicts with cells
    """
    rows = []
    all_row_elements = table.find_all("tr")

    for tr in all_row_elements:
        cells = _extract_cells(tr)
        if cells:  # Only add non-empty rows
            rows.append(
                {
                    "cells": cells,
                    "height": None,
                    "isHeader": False,  # Could be enhanced to detect thead rows
                    "backgroundColor": None,
                    "cssClass": None,
                }
            )

    return rows


def _extract_cells(tr: Tag) -> List[Dict[str, Any]]:
    """
    Extract cells from a table row.

    Args:
        tr: BeautifulSoup tr element

    Returns:
        List of cell dicts
    """
    cells = []
    cell_elements = tr.find_all(["td", "th"])

    for cell in cell_elements:
        # Extract cell content
        content = _extract_cell_content(cell)

        # Extract structural attributes
        colspan = int(cell.get("colspan", 1))
        rowspan = int(cell.get("rowspan", 1))

        # Extract alignment from style or align attribute
        alignment = _extract_alignment(cell)

        # Build cell dict matching TableCell schema
        cells.append(
            {
                "contentType": "text",
                "content": content,
                "imageData": None,
                "colspan": colspan,
                "rowspan": rowspan,
                "fontStyle": "normal",
                "alignment": alignment,
                "borders": None,
                "backgroundColor": None,
                "textColor": None,
                "hoverBgColor": None,
                "hoverTextColor": None,
                "cssClass": None,
            }
        )

    return cells


def _extract_cell_content(cell: Tag) -> str:
    """
    Extract content from a table cell.

    Preserves basic formatting like line breaks, bold, italic.

    Args:
        cell: BeautifulSoup td/th element

    Returns:
        Cell content as string
    """
    # Clone the cell to avoid modifying the original
    cell_clone = BeautifulSoup(str(cell), "html.parser").find(["td", "th"])
    if not cell_clone:
        return ""

    # Replace <br> tags with newlines
    for br in cell_clone.find_all("br"):
        br.replace_with("\n")

    # Replace block elements with newlines
    for block in cell_clone.find_all(["div", "p"]):
        # Add newline before block content
        if block.string:
            block.insert_before("\n")
        block.unwrap()

    # Get text content
    content = cell_clone.get_text()

    # Normalize whitespace (but preserve intentional newlines)
    lines = [line.strip() for line in content.split("\n")]
    # Remove empty lines but keep structure
    content = "\n".join(line for line in lines if line)

    return content.strip()


def _extract_alignment(cell: Tag) -> str:
    """
    Extract text alignment from cell.

    Args:
        cell: BeautifulSoup td/th element

    Returns:
        Alignment value: "left", "center", or "right"
    """
    # Check align attribute
    align = cell.get("align", "").lower()
    if align in ("left", "center", "right"):
        return align

    # Check style attribute for text-align
    style = cell.get("style", "")
    if "text-align" in style.lower():
        if "center" in style.lower():
            return "center"
        elif "right" in style.lower():
            return "right"
        elif "left" in style.lower():
            return "left"

    # Default alignment
    return "left"


def _calculate_max_columns(rows: List[Dict[str, Any]]) -> int:
    """
    Calculate maximum number of columns in table considering colspan.

    Args:
        rows: List of row dicts

    Returns:
        Maximum column count
    """
    max_cols = 0

    for row in rows:
        # Sum up colspan values for all cells in row
        cols_in_row = sum(cell.get("colspan", 1) for cell in row.get("cells", []))
        max_cols = max(max_cols, cols_in_row)

    return max_cols if max_cols > 0 else 1
