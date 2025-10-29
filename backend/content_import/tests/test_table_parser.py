"""Tests for HTML table parsing utilities."""

import pytest
from content_import.utils.table_parser import parse_html_table


class TestParseHTMLTable:
    """Tests for parse_html_table function."""

    def test_simple_2x2_table(self):
        """Test parsing a simple 2x2 table."""
        html = """
        <table>
            <tr>
                <td>Cell 1,1</td>
                <td>Cell 1,2</td>
            </tr>
            <tr>
                <td>Cell 2,1</td>
                <td>Cell 2,2</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert "rows" in result
        assert len(result["rows"]) == 2
        assert len(result["rows"][0]["cells"]) == 2
        assert result["rows"][0]["cells"][0]["content"] == "Cell 1,1"
        assert result["rows"][0]["cells"][1]["content"] == "Cell 1,2"
        assert result["rows"][1]["cells"][0]["content"] == "Cell 2,1"
        assert result["rows"][1]["cells"][1]["content"] == "Cell 2,2"

        # Check column widths
        assert result["columnWidths"] == ["auto", "auto"]

    def test_table_with_colspan(self):
        """Test parsing a table with colspan."""
        html = """
        <table>
            <tr>
                <td colspan="2">Merged cell</td>
            </tr>
            <tr>
                <td>Cell 2,1</td>
                <td>Cell 2,2</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert len(result["rows"]) == 2
        assert result["rows"][0]["cells"][0]["colspan"] == 2
        assert result["rows"][0]["cells"][0]["content"] == "Merged cell"
        assert len(result["columnWidths"]) == 2

    def test_table_with_rowspan(self):
        """Test parsing a table with rowspan."""
        html = """
        <table>
            <tr>
                <td rowspan="2">Tall cell</td>
                <td>Cell 1,2</td>
            </tr>
            <tr>
                <td>Cell 2,2</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert len(result["rows"]) == 2
        assert result["rows"][0]["cells"][0]["rowspan"] == 2
        assert result["rows"][0]["cells"][0]["content"] == "Tall cell"

    def test_table_with_headers(self):
        """Test parsing a table with thead and th elements."""
        html = """
        <table>
            <thead>
                <tr>
                    <th>Header 1</th>
                    <th>Header 2</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Data 1</td>
                    <td>Data 2</td>
                </tr>
            </tbody>
        </table>
        """
        result = parse_html_table(html)

        assert len(result["rows"]) == 2
        assert result["rows"][0]["cells"][0]["content"] == "Header 1"
        assert result["rows"][0]["cells"][1]["content"] == "Header 2"
        assert result["rows"][1]["cells"][0]["content"] == "Data 1"
        assert result["rows"][1]["cells"][1]["content"] == "Data 2"

    def test_table_with_alignment(self):
        """Test parsing a table with text alignment."""
        html = """
        <table>
            <tr>
                <td align="left">Left</td>
                <td align="center">Center</td>
                <td align="right">Right</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert result["rows"][0]["cells"][0]["alignment"] == "left"
        assert result["rows"][0]["cells"][1]["alignment"] == "center"
        assert result["rows"][0]["cells"][2]["alignment"] == "right"

    def test_table_with_style_alignment(self):
        """Test parsing a table with style-based alignment."""
        html = """
        <table>
            <tr>
                <td style="text-align: center">Center</td>
                <td style="text-align: right">Right</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert result["rows"][0]["cells"][0]["alignment"] == "center"
        assert result["rows"][0]["cells"][1]["alignment"] == "right"

    def test_table_with_empty_cells(self):
        """Test parsing a table with empty cells."""
        html = """
        <table>
            <tr>
                <td>Content</td>
                <td></td>
                <td>   </td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert result["rows"][0]["cells"][0]["content"] == "Content"
        assert result["rows"][0]["cells"][1]["content"] == ""
        assert result["rows"][0]["cells"][2]["content"] == ""

    def test_table_with_line_breaks(self):
        """Test parsing a table with line breaks in cells."""
        html = """
        <table>
            <tr>
                <td>Line 1<br>Line 2<br>Line 3</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        content = result["rows"][0]["cells"][0]["content"]
        assert "Line 1" in content
        assert "Line 2" in content
        assert "Line 3" in content
        # Should have newlines preserved
        assert "\n" in content

    def test_table_with_nested_elements(self):
        """Test parsing a table with nested div/p elements."""
        html = """
        <table>
            <tr>
                <td><div>Paragraph 1</div><div>Paragraph 2</div></td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        content = result["rows"][0]["cells"][0]["content"]
        assert "Paragraph 1" in content
        assert "Paragraph 2" in content

    def test_table_borders_enabled(self):
        """Test that borders are detected correctly."""
        html = '<table border="1"><tr><td>Test</td></tr></table>'
        result = parse_html_table(html)
        assert result["showBorders"] is True

    def test_table_borders_disabled(self):
        """Test that borders=0 is detected correctly."""
        html = '<table border="0"><tr><td>Test</td></tr></table>'
        result = parse_html_table(html)
        assert result["showBorders"] is False

    def test_table_default_settings(self):
        """Test that default settings are applied correctly."""
        html = "<table><tr><td>Test</td></tr></table>"
        result = parse_html_table(html)

        assert result["caption"] is None
        assert result["stripedRows"] is False
        assert result["hoverEffect"] is True
        assert result["responsive"] is True
        assert result["tableWidth"] == "full"

    def test_empty_html(self):
        """Test that empty HTML raises ValueError."""
        with pytest.raises(ValueError, match="No HTML content provided"):
            parse_html_table("")

    def test_no_table_element(self):
        """Test that HTML without table raises ValueError."""
        html = "<div>Not a table</div>"
        with pytest.raises(ValueError, match="No table element found"):
            parse_html_table(html)

    def test_table_without_rows(self):
        """Test that table without rows raises ValueError."""
        html = "<table></table>"
        with pytest.raises(ValueError, match="No rows found"):
            parse_html_table(html)

    def test_complex_table(self):
        """Test parsing a complex table with multiple features."""
        html = """
        <table border="1">
            <thead>
                <tr>
                    <th colspan="2">Header</th>
                    <th>Col 3</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td rowspan="2" align="center">Tall</td>
                    <td>1,2</td>
                    <td align="right">1,3</td>
                </tr>
                <tr>
                    <td>2,2</td>
                    <td>2,3</td>
                </tr>
            </tbody>
        </table>
        """
        result = parse_html_table(html)

        # Should have 3 rows total
        assert len(result["rows"]) == 3

        # First row has merged header
        assert result["rows"][0]["cells"][0]["colspan"] == 2
        assert result["rows"][0]["cells"][0]["content"] == "Header"

        # Second row has tall cell
        assert result["rows"][1]["cells"][0]["rowspan"] == 2
        assert result["rows"][1]["cells"][0]["alignment"] == "center"

        # Check column widths (max 3 columns)
        assert len(result["columnWidths"]) == 3

    def test_cell_content_type(self):
        """Test that all cells default to text content type."""
        html = """
        <table>
            <tr>
                <td>Text content</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)

        assert result["rows"][0]["cells"][0]["contentType"] == "text"
        assert result["rows"][0]["cells"][0]["imageData"] is None

    def test_cell_default_values(self):
        """Test that cells have correct default values."""
        html = """
        <table>
            <tr>
                <td>Test</td>
            </tr>
        </table>
        """
        result = parse_html_table(html)
        cell = result["rows"][0]["cells"][0]

        assert cell["colspan"] == 1
        assert cell["rowspan"] == 1
        assert cell["fontStyle"] == "normal"
        assert cell["alignment"] == "left"
        assert cell["borders"] is None
        assert cell["backgroundColor"] is None
        assert cell["textColor"] is None
        assert cell["hoverBgColor"] is None
        assert cell["hoverTextColor"] is None
        assert cell["cssClass"] is None

    def test_whitespace_normalization(self):
        """Test that whitespace is normalized in cell content."""
        html = """
        <table>
            <tr>
                <td>
                    Content with
                    multiple   spaces
                    and newlines
                </td>
            </tr>
        </table>
        """
        result = parse_html_table(html)
        content = result["rows"][0]["cells"][0]["content"]

        # Should have normalized whitespace but preserve line structure
        assert "Content with" in content
        assert "multiple   spaces" in content or "multiple spaces" in content
