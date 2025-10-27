/**
 * Tests for table import utilities
 */

import { describe, it, expect } from 'vitest'
import {
    detectPasteFormat,
    parseHTMLTable,
    parseTabDelimited,
    parseCSV,
    parseJSON,
    normalizeTableData,
    parseAuto
} from '../tableImport'

describe('detectPasteFormat', () => {
    it('detects HTML format', () => {
        const html = '<table><tr><td>Test</td></tr></table>'
        expect(detectPasteFormat(html)).toBe('html')
    })

    it('detects TSV format', () => {
        const tsv = 'Name\tAge\nJohn\t30'
        expect(detectPasteFormat(tsv)).toBe('tsv')
    })

    it('detects CSV format', () => {
        const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA'
        expect(detectPasteFormat(csv)).toBe('csv')
    })

    it('detects single-line CSV', () => {
        const csv = '1,2,3'
        expect(detectPasteFormat(csv)).toBe('csv')
    })

    it('detects JSON array of arrays', () => {
        const json = '[["Name","Age"],["John",30],["Jane",25]]'
        expect(detectPasteFormat(json)).toBe('json')
    })

    it('detects JSON array of objects', () => {
        const json = '[{"name":"John","age":30},{"name":"Jane","age":25}]'
        expect(detectPasteFormat(json)).toBe('json')
    })

    it('returns unknown for plain text', () => {
        const text = 'Just some text'
        expect(detectPasteFormat(text)).toBe('unknown')
    })

    it('returns unknown for empty string', () => {
        expect(detectPasteFormat('')).toBe('unknown')
    })

    it('prioritizes HTML over other formats', () => {
        const html = '<table><tr><td>A,B</td></tr></table>'
        expect(detectPasteFormat(html)).toBe('html')
    })

    it('prioritizes JSON over CSV', () => {
        const json = '["a,b","c,d"]' // Has commas but is valid JSON
        expect(detectPasteFormat(json)).toBe('json')
    })
})

describe('parseHTMLTable', () => {
    it('parses simple HTML table', () => {
        const html = `
            <table>
                <tr>
                    <td>Cell 1</td>
                    <td>Cell 2</td>
                </tr>
                <tr>
                    <td>Cell 3</td>
                    <td>Cell 4</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows).toHaveLength(2)
        expect(result.rows[0].cells).toHaveLength(2)
        expect(result.rows[0].cells[0].content).toBe('Cell 1')
        expect(result.rows[0].cells[1].content).toBe('Cell 2')
    })

    it('parses table with colspan', () => {
        const html = `
            <table>
                <tr>
                    <td colspan="2">Wide Cell</td>
                </tr>
                <tr>
                    <td>Cell 1</td>
                    <td>Cell 2</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows[0].cells[0].colspan).toBe(2)
        expect(result.rows[0].cells[0].content).toBe('Wide Cell')
    })

    it('parses table with rowspan', () => {
        const html = `
            <table>
                <tr>
                    <td rowspan="2">Tall Cell</td>
                    <td>Cell 2</td>
                </tr>
                <tr>
                    <td>Cell 3</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows[0].cells[0].rowspan).toBe(2)
    })

    it('strips HTML formatting and keeps only text content', () => {
        const html = `
            <table>
                <tr>
                    <td><strong>Bold</strong> and <em>italic</em> text</td>
                    <td><a href="#">Link text</a></td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // HTML formatting should be stripped, only text remains
        expect(result.rows[0].cells[0].content).toBe('Bold and italic text')
        expect(result.rows[0].cells[1].content).toBe('Link text')
    })

    it('strips style attributes and uses default alignment', () => {
        const html = `
            <table>
                <tr>
                    <td align="center" style="background-color: red; color: white;">Styled Cell</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // All styling should be stripped
        expect(result.rows[0].cells[0].alignment).toBe('left')
        expect(result.rows[0].cells[0].background_color).toBeUndefined()
        expect(result.rows[0].cells[0].text_color).toBeUndefined()
        expect(result.rows[0].cells[0].content).toBe('Styled Cell')
    })

    it('detects border attribute', () => {
        const htmlWithBorder = '<table border="1"><tr><td>Test</td></tr></table>'
        const htmlNoBorder = '<table border="0"><tr><td>Test</td></tr></table>'

        const resultWithBorder = parseHTMLTable(htmlWithBorder)
        const resultNoBorder = parseHTMLTable(htmlNoBorder)

        expect(resultWithBorder.show_borders).toBe(true)
        expect(resultNoBorder.show_borders).toBe(false)
    })

    it('throws error when no table element found', () => {
        const html = '<div>No table here</div>'
        expect(() => parseHTMLTable(html)).toThrow('No table element found')
    })

    it('throws error when HTML is empty', () => {
        expect(() => parseHTMLTable('')).toThrow('No HTML content provided')
    })

    it('handles thead and tbody', () => {
        const html = `
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
        `
        const result = parseHTMLTable(html)

        expect(result.rows).toHaveLength(2)
        expect(result.rows[0].cells[0].content).toBe('Header 1')
        expect(result.rows[1].cells[0].content).toBe('Data 1')
    })
})

describe('parseTabDelimited', () => {
    it('parses simple tab-delimited text', () => {
        const tsv = 'Name\tAge\tCity\nJohn\t30\tNYC\nJane\t25\tLA'
        const result = parseTabDelimited(tsv)

        expect(result.rows).toHaveLength(3)
        expect(result.rows[0].cells).toHaveLength(3)
        expect(result.rows[0].cells[0].content).toBe('Name')
        expect(result.rows[1].cells[0].content).toBe('John')
        expect(result.rows[1].cells[1].content).toBe('30')
    })

    it('handles empty cells', () => {
        const tsv = 'A\tB\tC\n1\t\t3'
        const result = parseTabDelimited(tsv)

        expect(result.rows[1].cells[1].content).toBe('')
    })

    it('normalizes rows with different column counts', () => {
        const tsv = 'A\tB\tC\n1\t2'
        const result = parseTabDelimited(tsv)

        expect(result.rows[1].cells).toHaveLength(3)
        expect(result.rows[1].cells[2].content).toBe('')
    })

    it('throws error for empty content', () => {
        expect(() => parseTabDelimited('')).toThrow('No content provided')
    })

    it('filters out empty lines', () => {
        const tsv = 'A\tB\n\n1\t2\n\n'
        const result = parseTabDelimited(tsv)

        expect(result.rows).toHaveLength(2)
    })
})

describe('parseCSV', () => {
    it('parses simple CSV text', () => {
        const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA'
        const result = parseCSV(csv)

        expect(result.rows).toHaveLength(3)
        expect(result.rows[0].cells).toHaveLength(3)
        expect(result.rows[0].cells[0].content).toBe('Name')
        expect(result.rows[1].cells[0].content).toBe('John')
        expect(result.rows[1].cells[1].content).toBe('30')
    })

    it('handles empty cells in CSV', () => {
        const csv = 'A,B,C\n1,,3'
        const result = parseCSV(csv)

        expect(result.rows[1].cells[1].content).toBe('')
    })

    it('normalizes rows with different column counts', () => {
        const csv = 'A,B,C\n1,2'
        const result = parseCSV(csv)

        expect(result.rows[1].cells).toHaveLength(3)
        expect(result.rows[1].cells[2].content).toBe('')
    })

    it('throws error for empty content', () => {
        expect(() => parseCSV('')).toThrow('No content provided')
    })

    it('filters out empty lines', () => {
        const csv = 'A,B\n\n1,2\n\n'
        const result = parseCSV(csv)

        expect(result.rows).toHaveLength(2)
    })

    it('trims whitespace from cells', () => {
        const csv = 'Name , Age\nJohn , 30'
        const result = parseCSV(csv)

        expect(result.rows[0].cells[0].content).toBe('Name')
        expect(result.rows[0].cells[1].content).toBe('Age')
    })

    it('parses single-line CSV', () => {
        const csv = '1,2,3'
        const result = parseCSV(csv)

        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].cells).toHaveLength(3)
        expect(result.rows[0].cells[0].content).toBe('1')
        expect(result.rows[0].cells[1].content).toBe('2')
        expect(result.rows[0].cells[2].content).toBe('3')
    })
})

describe('parseJSON', () => {
    it('parses JSON array of arrays', () => {
        const json = '[["Name","Age","City"],["John",30,"NYC"],["Jane",25,"LA"]]'
        const result = parseJSON(json)

        expect(result.rows).toHaveLength(3)
        expect(result.rows[0].cells).toHaveLength(3)
        expect(result.rows[0].cells[0].content).toBe('Name')
        expect(result.rows[1].cells[0].content).toBe('John')
        expect(result.rows[1].cells[1].content).toBe('30')
    })

    it('parses JSON array of objects with header row', () => {
        const json = '[{"name":"John","age":30,"city":"NYC"},{"name":"Jane","age":25,"city":"LA"}]'
        const result = parseJSON(json)

        expect(result.rows).toHaveLength(3) // Header + 2 data rows
        expect(result.rows[0].cells[0].content).toBe('name')
        expect(result.rows[1].cells[0].content).toBe('John')
        expect(result.rows[2].cells[0].content).toBe('Jane')
    })

    it('handles missing values in object arrays', () => {
        const json = '[{"name":"John","age":30},{"name":"Jane"}]'
        const result = parseJSON(json)

        expect(result.rows[2].cells[1].content).toBe('')
    })

    it('throws error for invalid JSON', () => {
        const invalid = '[{"name": invalid}]'
        expect(() => parseJSON(invalid)).toThrow('Invalid JSON format')
    })

    it('throws error for non-array JSON', () => {
        const notArray = '{"name":"John"}'
        expect(() => parseJSON(notArray)).toThrow('JSON must be an array')
    })

    it('throws error for empty array', () => {
        const empty = '[]'
        expect(() => parseJSON(empty)).toThrow('JSON array is empty')
    })

    it('throws error for mixed array types', () => {
        const mixed = '[["a","b"],{"c":"d"}]'
        expect(() => parseJSON(mixed)).toThrow('Mixed JSON format')
    })

    it('converts all values to strings', () => {
        const json = '[[1,2,3],[true,false,null]]'
        const result = parseJSON(json)

        expect(result.rows[0].cells[0].content).toBe('1')
        expect(result.rows[1].cells[0].content).toBe('true')
        expect(result.rows[1].cells[2].content).toBe('null')
    })
})

describe('normalizeTableData', () => {
    it('pads rows to match max column count', () => {
        const data = {
            rows: [
                { cells: [{ content: '1' }, { content: '2' }, { content: '3' }] },
                { cells: [{ content: '4' }, { content: '5' }] }
            ],
            column_widths: []
        }

        const result = normalizeTableData(data)

        expect(result.rows[1].cells).toHaveLength(3)
        expect(result.rows[1].cells[2].content).toBe('')
    })

    it('adjusts column_widths to match column count', () => {
        const data = {
            rows: [
                { cells: [{ content: '1' }, { content: '2' }, { content: '3' }] }
            ],
            column_widths: ['auto']
        }

        const result = normalizeTableData(data)

        expect(result.column_widths).toHaveLength(3)
        expect(result.column_widths[1]).toBe('auto')
    })

    it('throws error for invalid data structure', () => {
        expect(() => normalizeTableData(null)).toThrow('Invalid table data')
        expect(() => normalizeTableData({})).toThrow('Invalid table data')
    })

    it('throws error for empty rows', () => {
        const data = { rows: [] }
        expect(() => normalizeTableData(data)).toThrow('Table has no rows')
    })

    it('handles colspan when calculating column count', () => {
        const data = {
            rows: [
                {
                    cells: [
                        { content: '1', colspan: 2 },
                        { content: '2' }
                    ]
                }
            ],
            column_widths: []
        }

        const result = normalizeTableData(data)

        expect(result.column_widths).toHaveLength(3)
    })
})

describe('parseAuto', () => {
    it('auto-detects and parses HTML', () => {
        const html = '<table><tr><td>Test</td></tr></table>'
        const result = parseAuto(html)

        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].cells[0].content).toBe('Test')
    })

    it('auto-detects and parses TSV', () => {
        const tsv = 'A\tB\n1\t2'
        const result = parseAuto(tsv)

        expect(result.rows).toHaveLength(2)
        expect(result.rows[0].cells[0].content).toBe('A')
    })

    it('auto-detects and parses CSV', () => {
        const csv = 'A,B\n1,2\n3,4'
        const result = parseAuto(csv)

        expect(result.rows).toHaveLength(3)
        expect(result.rows[0].cells[0].content).toBe('A')
    })

    it('auto-detects and parses JSON', () => {
        const json = '[["A","B"],["1","2"]]'
        const result = parseAuto(json)

        expect(result.rows).toHaveLength(2)
        expect(result.rows[0].cells[0].content).toBe('A')
    })

    it('throws error for unknown format', () => {
        const text = 'Just plain text'
        expect(() => parseAuto(text)).toThrow('Could not detect table format')
    })
})

describe('HTML Sanitization', () => {
    it('strips nested HTML tags from cells', () => {
        const html = `
            <table>
                <tr>
                    <td><div><span>Nested</span> <strong>content</strong></div></td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows[0].cells[0].content).toBe('Nested content')
    })

    it('handles complex styled tables from webpages', () => {
        const html = `
            <table class="data-table" style="width: 100%">
                <tr style="background: #f0f0f0">
                    <td style="color: blue; font-weight: bold" class="header">
                        <span style="font-size: 14px">Header</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px">
                        <p>Paragraph content</p>
                    </td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // All styling and nested elements should be stripped
        expect(result.rows[0].cells[0].content).toBe('Header')
        expect(result.rows[1].cells[0].content).toBe('Paragraph content')
        expect(result.rows[0].cells[0].alignment).toBe('left')
    })

    it('preserves only colspan and rowspan attributes', () => {
        const html = `
            <table>
                <tr>
                    <td colspan="2" rowspan="2" class="special" data-id="123" style="color: red">
                        Cell content
                    </td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)
        const cell = result.rows[0].cells[0]

        // Structural attributes preserved
        expect(cell.colspan).toBe(2)
        expect(cell.rowspan).toBe(2)
        // Content preserved as plain text
        expect(cell.content).toBe('Cell content')
        // Styling stripped
        expect(cell.alignment).toBe('left')
        expect(cell.font_style).toBe('normal')
    })

    it('handles whitespace normalization', () => {
        const html = `
            <table>
                <tr>
                    <td>
                        Multiple   
                        whitespace   
                        characters
                    </td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // Multiple whitespace should be normalized to single spaces
        expect(result.rows[0].cells[0].content).toBe('Multiple whitespace characters')
    })

    it('preserves line breaks from <br> tags', () => {
        const html = `
            <table>
                <tr>
                    <td>Line 1<br>Line 2<br>Line 3</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // <br> tags should be converted to newlines
        expect(result.rows[0].cells[0].content).toBe('Line 1\nLine 2\nLine 3')
    })

    it('handles multiple <br> tags and mixed content', () => {
        const html = `
            <table>
                <tr>
                    <td>First line<br><br>Second line<br><strong>Bold text</strong></td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // Multiple <br> tags should create blank lines, HTML tags stripped
        expect(result.rows[0].cells[0].content).toBe('First line\n\nSecond line\nBold text')
    })

    it('converts <div> tags to line breaks', () => {
        const html = `
            <table>
                <tr>
                    <td><div>Line 1</div><div>Line 2</div><div>Line 3</div></td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // <div> tags should be converted to newlines (from contenteditable)
        expect(result.rows[0].cells[0].content).toBe('Line 1\nLine 2\nLine 3')
    })

    it('converts <p> tags to line breaks', () => {
        const html = `
            <table>
                <tr>
                    <td><p>Paragraph 1</p><p>Paragraph 2</p></td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        // <p> tags should be converted to newlines
        expect(result.rows[0].cells[0].content).toBe('Paragraph 1\nParagraph 2')
    })
})

