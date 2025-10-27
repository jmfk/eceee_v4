/**
 * Tests for table import utilities
 */

import { describe, it, expect } from 'vitest'
import {
    detectPasteFormat,
    parseHTMLTable,
    parseTabDelimited,
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

    it('returns unknown for plain text', () => {
        const text = 'Just some text'
        expect(detectPasteFormat(text)).toBe('unknown')
    })

    it('returns unknown for empty string', () => {
        expect(detectPasteFormat('')).toBe('unknown')
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

    it('preserves text alignment', () => {
        const html = `
            <table>
                <tr>
                    <td align="center">Centered</td>
                    <td align="right">Right</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows[0].cells[0].alignment).toBe('center')
        expect(result.rows[0].cells[1].alignment).toBe('right')
    })

    it('extracts background and text colors', () => {
        const html = `
            <table>
                <tr>
                    <td style="background-color: rgb(255, 0, 0); color: rgb(255, 255, 255);">Red BG</td>
                </tr>
            </table>
        `
        const result = parseHTMLTable(html)

        expect(result.rows[0].cells[0].background_color).toBe('rgb(255, 0, 0)')
        expect(result.rows[0].cells[0].text_color).toBe('rgb(255, 255, 255)')
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

    it('throws error for unknown format', () => {
        const text = 'Just plain text'
        expect(() => parseAuto(text)).toThrow('Could not detect table format')
    })
})

