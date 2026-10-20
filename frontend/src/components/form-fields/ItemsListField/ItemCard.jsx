import React, { useRef, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ItemForm from './ItemForm'

/**
 * ItemCard Component
 * 
 * UDC-integrated component - subscribes to item data changes and updates label in real-time.
 * Manages item-level state and passes current data to ItemForm.
 */
const ItemCard = ({
    initialItem,
    onItemChange,
    index,
    labelTemplate,
    isExpanded,
    onToggle,
    onRemove,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    schema,
    disabled,
    errors,
    context,
    namespace
}) => {

    // Item data ref - holds current item from UDC
    const itemRef = useRef(initialItem)

    // Index ref - keep current index without triggering callback re-creation
    const indexRef = useRef(index)
    indexRef.current = index // Update on every render, but doesn't trigger deps

    // Create stable, index-bound handlers to prevent re-renders
    const handleToggle = useCallback(() => {
        if (onToggle) onToggle(indexRef.current)
    }, [onToggle])

    const handleRemove = useCallback((e) => {
        e?.stopPropagation()
        if (onRemove) onRemove(indexRef.current)
    }, [onRemove])

    const handleMoveUp = useCallback((e) => {
        e?.stopPropagation()
        if (onMoveUp) onMoveUp(indexRef.current, indexRef.current - 1)
    }, [onMoveUp])

    const handleMoveDown = useCallback((e) => {
        e?.stopPropagation()
        if (onMoveDown) onMoveDown(indexRef.current, indexRef.current + 1)
    }, [onMoveDown])

    // Label update trigger
    const [labelKey, setLabelKey] = useState(0)

    React.useEffect(() => {
        if (itemRef.current !== initialItem) {
            itemRef.current = initialItem
            setLabelKey(value => value + 1)
        }
    }, [initialItem])

    const handleItemFieldChange = useCallback((changedFieldName, value) => {
        const updated = { ...itemRef.current, [changedFieldName]: value }
        itemRef.current = updated
        setLabelKey(key => key + 1)
        onItemChange(indexRef.current, updated)
    }, [onItemChange])

    // Generate label from itemRef.current (live data from UDC)
    const label = typeof labelTemplate === 'function'
        ? labelTemplate(itemRef.current, index)
        : labelTemplate || `Item ${index + 1}`

    const hasErrors = errors && errors.length > 0

    return (
        <div
            className={`transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
            role="region"
            aria-label={`Item ${index + 1}: ${label}`}
        >
            {/* Header */}
            <div className="flex items-center p-3 space-x-2">
                {/* Drag Handle (if reorderable) */}
                {(onMoveUp || onMoveDown) && (
                    <button
                        type="button"
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 cursor-move"
                        aria-label="Drag to reorder"
                        disabled={disabled}
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                )}

                {/* Index */}
                <div className="flex-shrink-0 w-6 text-xs text-gray-500 text-center font-medium">
                    {index + 1}
                </div>

                {/* Expand/Collapse Button */}
                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={disabled}
                    className="flex items-center space-x-2 flex-1 min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded px-2 py-1 -mx-2 -my-1"
                    aria-expanded={isExpanded}
                    aria-controls={`item-form-${index}`}
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${hasErrors ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {label}
                    </span>
                    {hasErrors && !isExpanded && (
                        <span className="text-xs text-red-600 ml-1 flex-shrink-0">
                            ({errors.length} {errors.length === 1 ? 'error' : 'errors'})
                        </span>
                    )}
                </button>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                    {/* Move Up */}
                    {canMoveUp && (
                        <button
                            type="button"
                            onClick={handleMoveUp}
                            disabled={disabled}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Move up"
                            title="Move up"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Move Down */}
                    {canMoveDown && (
                        <button
                            type="button"
                            onClick={handleMoveDown}
                            disabled={disabled}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Move down"
                            title="Move down"
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Remove Button */}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={disabled}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Remove item ${index + 1}`}
                            title="Remove item"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Form */}
            {isExpanded && (
                <div
                    id={`item-form-${index}`}
                    className="px-3 pb-3 pt-1 border-t border-gray-200 bg-white"
                    role="group"
                    aria-label={`Edit form for item ${index + 1}`}
                >
                    <ItemForm
                        item={itemRef.current}
                        context={context}
                        namespace={namespace}
                        schema={schema}
                        disabled={disabled}
                        errors={errors}
                        onFieldChange={handleItemFieldChange}
                    />
                </div>
            )}
        </div>
    )
}

ItemCard.displayName = 'ItemCard'

export default React.memo(ItemCard)
