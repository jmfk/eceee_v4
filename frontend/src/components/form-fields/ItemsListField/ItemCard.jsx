import React from 'react'
import { ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ItemForm from './ItemForm'

/**
 * ItemCard Component
 * 
 * Pure UI component - handles expand/collapse and button actions.
 * Item data is managed by ItemForm via UDC.
 */
const ItemCard = ({
    initialItem,
    index,
    labelTemplate,
    isExpanded,
    onToggle,
    onRemove,
    onMoveUp,
    onMoveDown,
    schema,
    disabled,
    errors,
    context
}) => {
    // Generate label from initialItem (will update via ItemForm's UDC)
    const label = typeof labelTemplate === 'function'
        ? labelTemplate(initialItem, index)
        : labelTemplate || `Item ${index + 1}`

    const hasErrors = errors && errors.length > 0
    console.log("render::ItemCard")
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
                    onClick={onToggle}
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
                    {onMoveUp && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onMoveUp()
                            }}
                            disabled={disabled}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Move up"
                            title="Move up"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Move Down */}
                    {onMoveDown && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onMoveDown()
                            }}
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
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove()
                            }}
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
                        initialItem={initialItem}
                        schema={schema}
                        disabled={disabled}
                        errors={errors}
                        context={context}
                        itemIndex={index}
                    />
                </div>
            )}
        </div>
    )
}

ItemCard.displayName = 'ItemCard'

// Memoize to prevent re-renders when parent re-renders
// Pure UI component - only re-renders when UI controls change
export default React.memo(ItemCard, (prevProps, nextProps) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.isExpanded === nextProps.isExpanded &&
        prevProps.schema === nextProps.schema &&
        prevProps.disabled === nextProps.disabled &&
        JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors) &&
        JSON.stringify(prevProps.context) === JSON.stringify(nextProps.context) &&
        prevProps.labelTemplate === nextProps.labelTemplate
    )
})

