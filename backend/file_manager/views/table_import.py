"""
Table Import API - Parse CSV and Excel files into table widget format
"""

import io
import logging
from typing import Dict, List, Any

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

# File size limit: 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024


def parse_csv_file(file_content: bytes, filename: str) -> List[List[str]]:
    """
    Parse CSV file content into 2D array of strings.

    Args:
        file_content: Raw file bytes
        filename: Original filename for error messages

    Returns:
        2D array of cell values

    Raises:
        ValueError: If parsing fails
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "pandas is required for CSV parsing. Install with: pip install pandas"
        )

    try:
        # Try common encodings
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                df = pd.read_csv(
                    io.BytesIO(file_content),
                    encoding=encoding,
                    keep_default_na=False,  # Don't convert empty strings to NaN
                    dtype=str,  # Keep everything as strings
                )
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError("Could not decode CSV file with common encodings")

        # Convert DataFrame to list of lists
        # Include header as first row
        rows = []
        if not df.empty:
            # Add header row
            rows.append(df.columns.tolist())
            # Add data rows
            rows.extend(df.values.tolist())

        return rows

    except Exception as e:
        logger.error(f"Error parsing CSV file {filename}: {str(e)}")
        raise ValueError(f"Failed to parse CSV file: {str(e)}")


def parse_excel_file(file_content: bytes, filename: str) -> List[List[str]]:
    """
    Parse Excel file content into 2D array of strings.

    Args:
        file_content: Raw file bytes
        filename: Original filename for error messages

    Returns:
        2D array of cell values

    Raises:
        ValueError: If parsing fails
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "pandas is required for Excel parsing. Install with: pip install pandas openpyxl"
        )

    try:
        # Read Excel file (reads first sheet by default)
        df = pd.read_excel(
            io.BytesIO(file_content),
            keep_default_na=False,  # Don't convert empty strings to NaN
            dtype=str,  # Keep everything as strings
        )

        # Convert DataFrame to list of lists
        rows = []
        if not df.empty:
            # Add header row
            rows.append(df.columns.tolist())
            # Add data rows
            rows.extend(df.values.tolist())

        return rows

    except Exception as e:
        logger.error(f"Error parsing Excel file {filename}: {str(e)}")
        raise ValueError(f"Failed to parse Excel file: {str(e)}")


def convert_to_table_widget_format(rows: List[List[str]]) -> Dict[str, Any]:
    """
    Convert 2D array of cell values to TableWidget format.

    Args:
        rows: 2D array of cell values

    Returns:
        TableWidget configuration dict
    """
    if not rows:
        return {"rows": [], "column_widths": []}

    # Determine max columns to ensure all rows have same length
    max_cols = max(len(row) for row in rows) if rows else 0

    # Build table configuration
    table_rows = []
    for row_data in rows:
        # Pad row with empty strings if needed
        padded_row = row_data + [""] * (max_cols - len(row_data))

        cells = []
        for cell_value in padded_row:
            # Convert to string and strip whitespace
            content = str(cell_value).strip() if cell_value is not None else ""

            cells.append(
                {
                    "content": content,
                    "content_type": "text",
                    "colspan": 1,
                    "rowspan": 1,
                    "font_style": "normal",
                    "alignment": "left",
                }
            )

        table_rows.append({"cells": cells, "height": "auto"})

    # Generate column widths (all auto)
    column_widths = ["auto"] * max_cols

    return {
        "rows": table_rows,
        "column_widths": column_widths,
        "caption": None,
        "show_borders": True,
        "striped_rows": False,
        "hover_effect": True,
        "responsive": True,
        "table_width": "full",
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_table_view(request):
    """
    Import table data from CSV or Excel file.

    Accepts:
        - CSV files (.csv)
        - Excel files (.xlsx, .xls)

    Returns:
        TableWidget configuration JSON
    """
    # Check if file was provided
    if "file" not in request.FILES:
        return Response(
            {"error": "No file provided. Please upload a CSV or Excel file."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    uploaded_file = request.FILES["file"]

    # Validate file size
    if uploaded_file.size > MAX_FILE_SIZE:
        return Response(
            {
                "error": f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024):.0f}MB."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get file extension
    filename = uploaded_file.name
    file_ext = filename.lower().split(".")[-1] if "." in filename else ""

    # Validate file type
    if file_ext not in ["csv", "xlsx", "xls"]:
        return Response(
            {
                "error": "Invalid file type. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Read file content
        file_content = uploaded_file.read()

        # Parse based on file type
        if file_ext == "csv":
            rows = parse_csv_file(file_content, filename)
        else:  # xlsx or xls
            rows = parse_excel_file(file_content, filename)

        # Convert to TableWidget format
        table_config = convert_to_table_widget_format(rows)

        return Response(table_config, status=status.HTTP_200_OK)

    except ImportError as e:
        logger.error(f"Missing dependency for table import: {str(e)}")
        return Response(
            {"error": "Server configuration error. Missing required libraries."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Unexpected error importing table from {filename}: {str(e)}")
        return Response(
            {"error": "An unexpected error occurred while processing the file."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
