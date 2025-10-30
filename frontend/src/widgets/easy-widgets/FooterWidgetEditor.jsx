import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, GripVertical, X } from 'lucide-react'

/**
 * FooterWidgetEditor Component
 * Custom editor for the Footer widget with column and item management
 */
const FooterWidgetEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange
}) => {
    const config = widgetData?.config || {}
    const [columns, setColumns] = useState(config.columns || [])
    const [columnCount, setColumnCount] = useState(config.columnCount || 3)
    const [draggedItem, setDraggedItem] = useState(null)

    // Sync state when widget config changes externally
    useEffect(() => {
        setColumns(config.columns || [])
        setColumnCount(config.columnCount || 3)
    }, [config.columns, config.columnCount])

    // Helper to update config
    const updateConfig = useCallback((newColumns, newColumnCount) => {
        if (onConfigChange) {
            onConfigChange({
                ...config,
                columns: newColumns,
                columnCount: newColumnCount
            })
        }
    }, [config, onConfigChange])

    // Add a new column
    const addColumn = useCallback(() => {
        const newColumns = [...columns, { title: '', items: [] }]
        const newColumnCount = newColumns.length
        setColumns(newColumns)
        setColumnCount(newColumnCount)
        updateConfig(newColumns, newColumnCount)
    }, [columns, updateConfig])

    // Remove a column
    const removeColumn = useCallback((columnIndex) => {
        if (columns.length <= 1) return // Minimum 1 column
        const newColumns = columns.filter((_, idx) => idx !== columnIndex)
        const newColumnCount = newColumns.length
        setColumns(newColumns)
        setColumnCount(newColumnCount)
        updateConfig(newColumns, newColumnCount)
    }, [columns, updateConfig])

    // Update column title
    const updateColumnTitle = useCallback((columnIndex, title) => {
        const newColumns = [...columns]
        newColumns[columnIndex] = { ...newColumns[columnIndex], title }
        setColumns(newColumns)
        updateConfig(newColumns, columnCount)
    }, [columns, columnCount, updateConfig])

    // Add item to column
    const addItem = useCallback((columnIndex) => {
        const newColumns = [...columns]
        newColumns[columnIndex].items.push({ label: '', url: '', openInNewTab: false })
        setColumns(newColumns)
        updateConfig(newColumns, columnCount)
    }, [columns, columnCount, updateConfig])

    // Remove item from column
    const removeItem = useCallback((columnIndex, itemIndex) => {
        const newColumns = [...columns]
        newColumns[columnIndex].items = newColumns[columnIndex].items.filter((_, idx) => idx !== itemIndex)
        setColumns(newColumns)
        updateConfig(newColumns, columnCount)
    }, [columns, columnCount, updateConfig])

    // Update item
    const updateItem = useCallback((columnIndex, itemIndex, field, value) => {
        const newColumns = [...columns]
        newColumns[columnIndex].items[itemIndex] = {
            ...newColumns[columnIndex].items[itemIndex],
            [field]: value
        }
        setColumns(newColumns)
        updateConfig(newColumns, columnCount)
    }, [columns, columnCount, updateConfig])

    // Drag and drop handlers for items
    const handleDragStart = useCallback((columnIndex, itemIndex) => {
        setDraggedItem({ columnIndex, itemIndex })
    }, [])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
    }, [])

    const handleDrop = useCallback((columnIndex, itemIndex) => {
        if (!draggedItem) return
        if (draggedItem.columnIndex === columnIndex && draggedItem.itemIndex === itemIndex) {
            setDraggedItem(null)
            return
        }

        const newColumns = [...columns]
        const sourceColumn = newColumns[draggedItem.columnIndex]
        const targetColumn = newColumns[columnIndex]

        // Remove item from source
        const [movedItem] = sourceColumn.items.splice(draggedItem.itemIndex, 1)

        // Add to target at new position
        if (draggedItem.columnIndex === columnIndex) {
            // Same column - adjust index if needed
            const adjustedIndex = draggedItem.itemIndex < itemIndex ? itemIndex - 1 : itemIndex
            targetColumn.items.splice(adjustedIndex, 0, movedItem)
        } else {
            // Different column
            targetColumn.items.splice(itemIndex, 0, movedItem)
        }

        setColumns(newColumns)
        setDraggedItem(null)
        updateConfig(newColumns, columnCount)
    }, [columns, columnCount, draggedItem, updateConfig])

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold">Footer Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Configure your footer columns and links
                </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Columns Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Footer Columns</h3>
                        <button
                            type="button"
                            onClick={addColumn}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            disabled={columns.length >= 6}
                        >
                            <Plus size={16} />
                            Add Column
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {columns.map((column, columnIndex) => (
                            <div
                                key={columnIndex}
                                className="border border-gray-300 rounded-lg p-4 bg-white"
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-gray-600">
                                        Column {columnIndex + 1}
                                    </span>
                                    {columns.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeColumn(columnIndex)}
                                            className="text-red-600 hover:text-red-800"
                                            title="Remove column"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Column Title */}
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Title (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={column.title || ''}
                                        onChange={(e) => updateColumnTitle(columnIndex, e.target.value)}
                                        placeholder="e.g., Quick Links"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Column Items */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-medium text-gray-700">
                                            Items
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => addItem(columnIndex)}
                                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                        >
                                            <Plus size={14} />
                                            Add
                                        </button>
                                    </div>

                                    {column.items && column.items.length > 0 ? (
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {column.items.map((item, itemIndex) => (
                                                <div
                                                    key={itemIndex}
                                                    draggable
                                                    onDragStart={() => handleDragStart(columnIndex, itemIndex)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={() => handleDrop(columnIndex, itemIndex)}
                                                    className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2 cursor-move hover:border-gray-300"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <GripVertical size={16} className="text-gray-400 mt-1.5 flex-shrink-0" />
                                                        <div className="flex-1 space-y-2">
                                                            {/* Label */}
                                                            <input
                                                                type="text"
                                                                value={item.label || ''}
                                                                onChange={(e) => updateItem(columnIndex, itemIndex, 'label', e.target.value)}
                                                                placeholder="Label *"
                                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />

                                                            {/* URL */}
                                                            <input
                                                                type="text"
                                                                value={item.url || ''}
                                                                onChange={(e) => updateItem(columnIndex, itemIndex, 'url', e.target.value)}
                                                                placeholder="URL (optional)"
                                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />

                                                            {/* Open in New Tab */}
                                                            {item.url && (
                                                                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.openInNewTab || false}
                                                                        onChange={(e) => updateItem(columnIndex, itemIndex, 'openInNewTab', e.target.checked)}
                                                                        className="rounded"
                                                                    />
                                                                    Open in new tab
                                                                </label>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(columnIndex, itemIndex)}
                                                            className="text-red-600 hover:text-red-800 flex-shrink-0"
                                                            title="Remove item"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic py-2">
                                            No items yet. Click "Add" to create one.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                        {columns.length === 1 && 'Minimum 1 column required. '}
                        {columns.length >= 6 && 'Maximum 6 columns allowed. '}
                        Drag items to reorder them.
                    </p>
                </div>

                {/* Additional Settings - Social Links & Copyright handled by schema-driven form */}
                <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                    <p className="font-medium mb-1">Additional Settings</p>
                    <p className="text-xs">
                        Background color, social links, and copyright settings can be configured in the other form fields below.
                    </p>
                </div>
            </div>
        </div>
    )
}

// Define metadata for editor registration
FooterWidgetEditor.displayName = 'FooterWidgetEditor'
FooterWidgetEditor.forWidgetType = 'easy_widgets.FooterWidget'

export default FooterWidgetEditor

