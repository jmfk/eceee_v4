import React, { useState, useRef } from 'react'
import { GripVertical, Plus, X, ArrowUp, ArrowDown, List } from 'lucide-react'

/**
 * ReorderableInput Component
 * 
 * Drag-and-drop sortable list component with add/remove functionality.
 * Supports nested items, custom rendering, and keyboard reordering.
 */
const ReorderableInput = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Add new item...',
    allowAdd = true,
    allowRemove = true,
    allowReorder = true,
    maxItems,
    itemTemplate = { label: '', value: '' },
    itemRender = (item, index) => item.label || item.value || `Item ${index + 1}`,
    addButtonText = 'Add Item',
    emptyText = 'No items added',
    showIndices = true,
    ...props
}) => {
    const [draggedIndex, setDraggedIndex] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)
    const [newItemValue, setNewItemValue] = useState('')
    const dragCounter = useRef(0)

    const items = Array.isArray(value) ? value : []

    // Handle drag start
    const handleDragStart = (e, index) => {
        if (disabled || !allowReorder) return

        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', e.target.outerHTML)
        e.dataTransfer.setDragImage(e.target, 0, 0)
    }

    // Handle drag over
    const handleDragOver = (e, index) => {
        if (disabled || !allowReorder) return

        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        if (draggedIndex !== null && index !== draggedIndex) {
            setDragOverIndex(index)
        }
    }

    // Handle drag enter
    const handleDragEnter = (e) => {
        if (disabled || !allowReorder) return
        dragCounter.current++
    }

    // Handle drag leave
    const handleDragLeave = (e) => {
        if (disabled || !allowReorder) return
        dragCounter.current--
        if (dragCounter.current === 0) {
            setDragOverIndex(null)
        }
    }

    // Handle drop
    const handleDrop = (e, dropIndex) => {
        if (disabled || !allowReorder || draggedIndex === null) return

        e.preventDefault()

        const newItems = [...items]
        const draggedItem = newItems[draggedIndex]

        // Remove dragged item
        newItems.splice(draggedIndex, 1)

        // Insert at new position
        const insertIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex
        newItems.splice(insertIndex, 0, draggedItem)

        onChange(newItems)
        setDraggedIndex(null)
        setDragOverIndex(null)
        dragCounter.current = 0
    }

    // Handle drag end
    const handleDragEnd = () => {
        setDraggedIndex(null)
        setDragOverIndex(null)
        dragCounter.current = 0
    }

    // Add new item
    const handleAddItem = () => {
        if (disabled || !allowAdd) return
        if (maxItems && items.length >= maxItems) return

        const newItem = typeof itemTemplate === 'function'
            ? itemTemplate(newItemValue)
            : typeof itemTemplate === 'string'
                ? newItemValue
                : { ...itemTemplate, label: newItemValue, value: newItemValue }

        onChange([...items, newItem])
        setNewItemValue('')
    }

    // Remove item
    const handleRemoveItem = (index) => {
        if (disabled || !allowRemove) return

        const newItems = items.filter((_, i) => i !== index)
        onChange(newItems)
    }

    // Move item up/down
    const moveItem = (index, direction) => {
        if (disabled || !allowReorder) return

        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= items.length) return

        const newItems = [...items]
        const [movedItem] = newItems.splice(index, 1)
        newItems.splice(newIndex, 0, movedItem)

        onChange(newItems)
    }

    // Handle key press for adding items
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && newItemValue.trim()) {
            e.preventDefault()
            handleAddItem()
        }
    }

    const hasError = validation && !validation.isValid
    const canAddMore = !maxItems || items.length < maxItems

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className={`border rounded-lg ${hasError ? 'border-red-300' : 'border-gray-300'}`}>
                {/* Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <List className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">
                            Items ({items.length}{maxItems ? `/${maxItems}` : ''})
                        </span>
                    </div>

                    {allowReorder && items.length > 1 && (
                        <div className="text-xs text-gray-500">
                            Drag to reorder
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="divide-y divide-gray-200">
                    {items.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            <List className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <div className="text-sm">{emptyText}</div>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div
                                key={index}
                                draggable={allowReorder && !disabled}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    flex items-center space-x-3 p-3 transition-colors
                                    ${draggedIndex === index ? 'opacity-50' : ''}
                                    ${dragOverIndex === index ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                                    ${allowReorder && !disabled ? 'cursor-move' : ''}
                                `}
                            >
                                {/* Drag Handle */}
                                {allowReorder && (
                                    <div className="flex-shrink-0">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                )}

                                {/* Index */}
                                {showIndices && (
                                    <div className="flex-shrink-0 w-6 text-xs text-gray-500 text-center">
                                        {index + 1}
                                    </div>
                                )}

                                {/* Item Content */}
                                <div className="flex-1 min-w-0">
                                    {typeof itemRender === 'function' ? (
                                        itemRender(item, index)
                                    ) : (
                                        <div className="truncate">
                                            {item.label || item.value || `Item ${index + 1}`}
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="flex items-center space-x-1">
                                    {/* Move Up/Down Buttons */}
                                    {allowReorder && !disabled && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move up"
                                            >
                                                <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'down')}
                                                disabled={index === items.length - 1}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move down"
                                            >
                                                <ArrowDown className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}

                                    {/* Remove Button */}
                                    {allowRemove && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            disabled={disabled}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                            title="Remove item"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Item */}
                {allowAdd && canAddMore && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={newItemValue}
                                onChange={(e) => setNewItemValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={placeholder}
                                disabled={disabled}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={handleAddItem}
                                disabled={disabled || !newItemValue.trim()}
                                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="text-sm">{addButtonText}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                    {validation.errors[0]}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}
        </div>
    )
}

ReorderableInput.displayName = 'ReorderableInput'

export default ReorderableInput
