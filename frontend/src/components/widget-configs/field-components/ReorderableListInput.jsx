import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Reorderable List Input Component
 * 
 * For managing arrays of objects with add/remove/reorder functionality
 */
export default function ReorderableListInput({
    value = [],
    onChange,
    itemTemplate = {},
    label,
    description,
    renderItem,
    allowAdd = true,
    allowRemove = true,
    allowReorder = true,
    disabled = false,
    className = '',
    addButtonText = 'Add Item',
    emptyText = 'No items yet'
}) {
    const [expandedItems, setExpandedItems] = useState(new Set())

    const handleAdd = () => {
        const newItem = { ...itemTemplate, _id: `item-${Date.now()}` }
        onChange([...value, newItem])
    }

    const handleRemove = (index) => {
        const newValue = value.filter((_, i) => i !== index)
        onChange(newValue)
    }

    const handleUpdate = (index, updatedItem) => {
        const newValue = value.map((item, i) => (i === index ? updatedItem : item))
        onChange(newValue)
    }

    const handleMoveUp = (index) => {
        if (index === 0) return
        const newValue = [...value]
            ;[newValue[index - 1], newValue[index]] = [newValue[index], newValue[index - 1]]
        onChange(newValue)
    }

    const handleMoveDown = (index) => {
        if (index === value.length - 1) return
        const newValue = [...value]
            ;[newValue[index], newValue[index + 1]] = [newValue[index + 1], newValue[index]]
        onChange(newValue)
    }

    const toggleExpanded = (index) => {
        const newExpanded = new Set(expandedItems)
        if (newExpanded.has(index)) {
            newExpanded.delete(index)
        } else {
            newExpanded.add(index)
        }
        setExpandedItems(newExpanded)
    }

    const defaultRenderItem = (item, index) => {
        const isExpanded = expandedItems.has(index)

        return (
            <div key={item._id || index} className="border border-gray-200 rounded-lg bg-white">
                <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div className="flex items-center space-x-2 flex-1">
                        {allowReorder && (
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                        )}

                        <button
                            type="button"
                            onClick={() => toggleExpanded(index)}
                            className="flex items-center space-x-2 flex-1 text-left"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                                Item {index + 1}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center space-x-1">
                        {allowReorder && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0 || disabled}
                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move up"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === value.length - 1 || disabled}
                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move down"
                                >
                                    ↓
                                </button>
                            </>
                        )}

                        {allowRemove && (
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                disabled={disabled}
                                className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto">
                            {JSON.stringify(item, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        )
    }

    const itemRenderer = renderItem || defaultRenderItem

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            {description && (
                <div className="text-xs text-gray-500 mb-2">{description}</div>
            )}

            <div className="space-y-2">
                {value.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <div className="text-gray-500 text-sm">{emptyText}</div>
                    </div>
                ) : (
                    value.map((item, index) => itemRenderer(item, index, handleUpdate))
                )}
            </div>

            {allowAdd && (
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={disabled}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" />
                    <span>{addButtonText}</span>
                </button>
            )}
        </div>
    )
}

