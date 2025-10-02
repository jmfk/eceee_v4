import React from 'react'
import { Table } from 'lucide-react'

/**
 * ECEEE Table Widget Component
 * Renders configurable data tables with advanced styling and cell spanning
 */
const eceeeTableWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        rows = [],
        caption = '',
        show_borders = true,
        striped_rows = true,
        hover_effect = true,
        responsive = true,
        table_width = 'full',
        css_class = ''
    } = config

    if (mode === 'editor') {
        return (
            <div className="table-widget-editor p-4">
                {rows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className={`border-collapse ${table_width === 'full' ? 'w-full' : 'w-auto'} ${show_borders ? 'border border-gray-300' : ''} ${css_class}`}>
                            {caption && (
                                <caption className="text-sm font-medium text-gray-700 mb-2">{caption}</caption>
                            )}
                            <tbody>
                                {rows.map((row, rowIndex) => (
                                    <tr key={rowIndex}
                                        className={`
                                            ${row.is_header ? 'bg-gray-100 font-semibold' : ''} 
                                            ${striped_rows && !row.is_header && rowIndex % 2 === 1 ? 'bg-gray-50' : ''} 
                                            ${hover_effect ? 'hover:bg-gray-100' : ''}
                                            ${row.css_class || ''}
                                        `}
                                        style={row.background_color ? { backgroundColor: row.background_color } : {}}>
                                        {row.cells?.map((cell, cellIndex) => {
                                            const CellTag = row.is_header ? 'th' : 'td'
                                            return (
                                                <CellTag
                                                    key={cellIndex}
                                                    colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                                                    rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                                                    className={`
                                                        ${show_borders ? 'border border-gray-300' : ''}
                                                        px-3 py-2 text-${cell.alignment || 'left'}
                                                        ${cell.font_weight === 'bold' ? 'font-bold' : ''}
                                                        ${cell.font_style === 'italic' ? 'italic' : ''}
                                                        ${cell.css_class || ''}
                                                    `}
                                                    style={{
                                                        backgroundColor: cell.background_color,
                                                        color: cell.text_color,
                                                        padding: cell.padding,
                                                        border: cell.border
                                                    }}
                                                >
                                                    <div dangerouslySetInnerHTML={{ __html: cell.content || '' }} />
                                                </CellTag>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-gray-200 h-24 rounded flex items-center justify-center text-gray-500">
                        <Table className="h-8 w-8 mr-2" />
                        Table placeholder
                    </div>
                )}
            </div>
        )
    }

    if (rows.length === 0) {
        return (
            <div className="table-widget">
                <div className="bg-gray-200 h-24 rounded flex items-center justify-center text-gray-500">
                    <Table className="h-8 w-8 mr-2" />
                    No table data
                </div>
            </div>
        )
    }

    return (
        <div className={`table-widget ${responsive ? 'overflow-x-auto' : ''}`}>
            <table className={`border-collapse ${table_width === 'full' ? 'w-full' : 'w-auto'} ${show_borders ? 'border border-gray-300' : ''} ${css_class}`}>
                {caption && (
                    <caption className="text-sm font-medium text-gray-700 mb-2">{caption}</caption>
                )}
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}
                            className={`
                                ${row.is_header ? 'bg-gray-100 font-semibold' : ''} 
                                ${striped_rows && !row.is_header && rowIndex % 2 === 1 ? 'bg-gray-50' : ''} 
                                ${hover_effect ? 'hover:bg-gray-100' : ''}
                                ${row.css_class || ''}
                            `}
                            style={row.background_color ? { backgroundColor: row.background_color } : {}}>
                            {row.cells?.map((cell, cellIndex) => {
                                const CellTag = row.is_header ? 'th' : 'td'
                                return (
                                    <CellTag
                                        key={cellIndex}
                                        colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                                        rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                                        className={`
                                            ${show_borders ? 'border border-gray-300' : ''}
                                            px-3 py-2 text-${cell.alignment || 'left'}
                                            ${cell.font_weight === 'bold' ? 'font-bold' : ''}
                                            ${cell.font_style === 'italic' ? 'italic' : ''}
                                            ${cell.css_class || ''}
                                        `}
                                        style={{
                                            backgroundColor: cell.background_color,
                                            color: cell.text_color,
                                            padding: cell.padding,
                                            border: cell.border
                                        }}
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: cell.content || '' }} />
                                    </CellTag>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// === COLOCATED METADATA ===
eceeeTableWidget.displayName = 'TableWidget'
eceeeTableWidget.widgetType = 'eceee_widgets.TableWidget'

// Default configuration
eceeeTableWidget.defaultConfig = {
    rows: [
        {
            is_header: true,
            cells: [
                { content: 'Header 1', alignment: 'left' },
                { content: 'Header 2', alignment: 'left' },
                { content: 'Header 3', alignment: 'left' }
            ]
        },
        {
            is_header: false,
            cells: [
                { content: 'Cell 1', alignment: 'left' },
                { content: 'Cell 2', alignment: 'left' },
                { content: 'Cell 3', alignment: 'left' }
            ]
        }
    ],
    caption: '',
    show_borders: true,
    striped_rows: true,
    hover_effect: true,
    responsive: true,
    table_width: 'full'
}

// Display metadata
eceeeTableWidget.metadata = {
    name: 'ECEEE Table',
    description: 'Configurable data tables with advanced styling, cell spanning, and responsive design',
    category: 'data',
    icon: Table,
    tags: ['eceee', 'table', 'data', 'grid', 'spreadsheet', 'rows', 'columns']
}

export default eceeeTableWidget
