import React, { useRef, useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ItemForm from './ItemForm'
import { useUnifiedData } from '../../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../../contexts/unified-data/types/operations'
import { lookupWidget } from '../../../utils/widgetUtils'

/**
 * ItemCard Component
 * 
 * UDC-integrated component - subscribes to item data changes and updates label in real-time.
 * Manages item-level state and passes current data to ItemForm.
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
    canMoveUp,
    canMoveDown,
    schema,
    disabled,
    errors,
    // UDC context props (passed individually for stable memo comparison)
    widgetId,
    slotName,
    contextType,
    widgetPath,
    fieldName,
    parentComponentId
}) => {

    // UDC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()

    // Create hierarchical componentId using parent's ID as prefix
    const componentId = useMemo(() => {
        if (parentComponentId) {
            return `${parentComponentId}-item-${index}`
        }
        // Fallback for standalone use
        return `item-card-${widgetId || 'preview'}-${fieldName || 'items'}-${index}`
    }, [parentComponentId, widgetId, fieldName, index])

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

    // Handle field changes from ItemForm - update local storage and publish to UDC
    const handleItemFieldChange = useCallback(async (changedFieldName, value) => {
        // Update local storage (itemRef)
        const updatedItem = {
            ...itemRef.current,
            [changedFieldName]: value
        }
        itemRef.current = updatedItem
        setLabelKey(prev => prev + 1) // Force label re-render

        // Publish to UDC if context is available
        if (!publishUpdate || !widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        // Get current items array from UDC
        const state = getState()
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)

        if (widget && widget.config) {
            const currentItems = widget.config[fieldName] || []
            const newItems = [...currentItems]
            newItems[indexRef.current] = updatedItem // Use indexRef.current instead of index

            // Merge with existing config to preserve other fields
            const updatedConfig = {
                ...widget.config,
                [fieldName]: newItems
            }

            // Publish full array to UDC
            await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: updatedConfig,
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [publishUpdate, widgetId, slotName, contextType, fieldName, widgetPath, componentId, getState])

    // Subscribe to UDC for external changes only
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && widget.config[fieldName]) {
            const items = widget.config[fieldName]
            if (Array.isArray(items) && items[index] !== undefined) {
                const udcItem = items[index]
                // Only update if item actually changed
                if (JSON.stringify(udcItem) !== JSON.stringify(itemRef.current)) {
                    itemRef.current = udcItem
                    setLabelKey(prev => prev + 1) // Force label re-render
                }
            }
        }
    })

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

// Memoize to prevent re-renders when parent re-renders
// UDC-integrated component - manages its own state via UDC subscription
// DOES NOT re-render based on initialItem - only uses it for initial mount
export default React.memo(ItemCard, (prevProps, nextProps) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.isExpanded === nextProps.isExpanded &&
        prevProps.canMoveUp === nextProps.canMoveUp &&
        prevProps.canMoveDown === nextProps.canMoveDown &&
        prevProps.schema === nextProps.schema &&
        prevProps.disabled === nextProps.disabled &&
        prevProps.onToggle === nextProps.onToggle &&
        prevProps.onRemove === nextProps.onRemove &&
        prevProps.onMoveUp === nextProps.onMoveUp &&
        prevProps.onMoveDown === nextProps.onMoveDown &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.contextType === nextProps.contextType &&
        prevProps.fieldName === nextProps.fieldName &&
        prevProps.parentComponentId === nextProps.parentComponentId &&
        JSON.stringify(prevProps.widgetPath) === JSON.stringify(nextProps.widgetPath) &&
        JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors) &&
        prevProps.labelTemplate === nextProps.labelTemplate
        // Deliberately NOT comparing initialItem - we use UDC subscription for updates
    )
})

