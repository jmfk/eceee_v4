import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Plus, List, ChevronDown, ChevronRight } from 'lucide-react'
import ItemCard from './ItemsListField/ItemCard'
import { parseItemSchema } from './ItemsListField/itemSchemaParser'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget } from '../../utils/widgetUtils'

// Generate unique ID for items to maintain stable React keys
const generateItemId = () => {
    return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * ItemsListField Component
 * 
 * A reusable field component for managing lists of complex items.
 * Each item can have multiple fields that are displayed in an expandable card.
 * 
 * Features:
 * - Add/remove items
 * - Expand/collapse items
 * - Dynamic field rendering based on schema
 * - Validation per item and list-level
 * - Drag-and-drop reordering (optional)
 * - Accessibility support
 * 
 * @example
 * <ItemsListField
 *   label="Menu Items"
 *   value={[{label: 'Home', url: '/', is_active: true}]}
 *   onChange={handleChange}
 *   itemSchema={{
 *     type: 'object',
 *     properties: {
 *       label: { type: 'string', title: 'Label' },
 *       url: { type: 'string', title: 'URL' },
 *       is_active: { type: 'boolean', title: 'Active' }
 *     }
 *   }}
 *   itemLabelTemplate={(item) => `${item.label} - ${item.url}`}
 * />
 */
const ItemsListField = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    // ItemsListField specific props
    itemSchema,
    itemLabelTemplate,
    defaultItem,
    maxItems,
    minItems,
    allowReorder = false,
    allowAdd = true,
    allowRemove = true,
    addButtonText = 'Add Item',
    emptyText = 'No items added yet',
    autoExpandNew = true,
    accordionMode = false, // Only one item expanded at a time
    // UDC integration props (passed from context)
    context = {},
    namespace = null,
    ...props
}) => {
    // Extract UDC context info
    const widgetId = context?.widgetId
    const slotName = context?.slotName
    const contextType = context?.contextType
    const widgetPath = context?.widgetPath
    const fieldName = props.fieldName || props['data-field-name'] // Get field name from props

    // UDC Integration - component must be inside UnifiedDataProvider
    const { useExternalChanges, publishUpdate: udcPublishUpdate } = useUnifiedData()

    const componentId = useMemo(() =>
        `items-list-field-${widgetId || 'preview'}-${fieldName || 'items'}`,
        [widgetId, fieldName]
    )

    // Ref-based data storage (no re-render on data updates)
    // Ensure all items have unique _itemId for stable React keys
    const itemsRef = useRef(
        Array.isArray(value) 
            ? value.map(item => item._itemId ? item : { ...item, _itemId: generateItemId() })
            : []
    )

    // Manual re-render mechanism
    const [renderKey, setRenderKey] = useState(0)
    const forceRerender = useCallback(() => {
        setRenderKey(prev => prev + 1)
    }, [])

    // UI state (keeps re-rendering for UI interactions)
    const [expandedItems, setExpandedItems] = useState(new Set())
    const [itemErrors, setItemErrors] = useState({})
    const lastAddedIndex = useRef(null)

    // Subscribe to UDC external changes
    // useExternalChanges is a hook that handles useEffect internally
    useExternalChanges(componentId, (state, metadata) => {
        if (!widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && widget.config[fieldName]) {
            const rawItems = widget.config[fieldName]
            
            // Ensure all items have _itemId for stable React keys
            const newItems = Array.isArray(rawItems)
                ? rawItems.map(item => item._itemId ? item : { ...item, _itemId: generateItemId() })
                : []

            // Only update if items actually changed
            if (JSON.stringify(newItems) !== JSON.stringify(itemsRef.current)) {
                // Check if change is from a sub-component (ItemForm within this list)
                const isSubComponentUpdate = metadata?.sourceId?.startsWith(componentId + '-item-')

                if (isSubComponentUpdate) {
                    // Silent update - just sync ref, no re-render
                    itemsRef.current = newItems
                } else {
                    // External update - sync ref AND re-render
                    itemsRef.current = newItems
                    forceRerender()
                }
            }
        }
    })

    // Publish to UDC helper
    const publishItemsUpdate = useCallback(async (newItems) => {
        // Always call onChange for compatibility
        onChange(newItems)

        // If UDC is available and we have context, publish to it
        if (udcPublishUpdate && widgetId && slotName && contextType && fieldName) {
            await udcPublishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: { [fieldName]: newItems },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [widgetId, slotName, contextType, fieldName, widgetPath, componentId, udcPublishUpdate, onChange])

    // Parse the item schema to get field definitions
    const parsedSchema = useMemo(() => parseItemSchema(itemSchema), [itemSchema])

    // Auto-expand newly added items
    useEffect(() => {
        if (autoExpandNew && lastAddedIndex.current !== null) {
            const newExpanded = new Set(accordionMode ? [] : expandedItems)
            newExpanded.add(lastAddedIndex.current)
            setExpandedItems(newExpanded)
            lastAddedIndex.current = null
        }
    }, [renderKey, autoExpandNew, accordionMode])

    // Generate a label for an item
    const getItemLabel = useCallback((item, index) => {
        if (typeof itemLabelTemplate === 'function') {
            return itemLabelTemplate(item, index)
        }

        // Default: use first field value or "Item N"
        if (parsedSchema && parsedSchema.fields && parsedSchema.fields.length > 0) {
            const firstField = parsedSchema.fields[0]
            const firstValue = item[firstField.name]
            if (firstValue !== undefined && firstValue !== null && firstValue !== '') {
                return String(firstValue)
            }
        }

        return `Item ${index + 1}`
    }, [itemLabelTemplate, parsedSchema])

    // Toggle item expansion
    const toggleItemExpansion = useCallback((index) => {
        setExpandedItems(prev => {
            const newExpanded = new Set(prev)

            if (accordionMode) {
                // Close all, then open this one if it wasn't open
                const wasOpen = newExpanded.has(index)
                newExpanded.clear()
                if (!wasOpen) {
                    newExpanded.add(index)
                }
            } else {
                // Toggle this item
                if (newExpanded.has(index)) {
                    newExpanded.delete(index)
                } else {
                    newExpanded.add(index)
                }
            }

            return newExpanded
        })
    }, [accordionMode])

    // Add new item
    const handleAddItem = useCallback(async () => {
        if (disabled || !allowAdd) return
        if (maxItems && itemsRef.current.length >= maxItems) return

        // Create default item from schema or use provided default
        const baseItem = defaultItem
            ? (typeof defaultItem === 'function' ? defaultItem() : { ...defaultItem })
            : parsedSchema.defaultValues || {}
        
        // Add unique ID for stable React keys
        const newItem = {
            ...baseItem,
            _itemId: generateItemId()
        }

        const newItems = [...itemsRef.current, newItem]
        lastAddedIndex.current = newItems.length - 1
        itemsRef.current = newItems
        forceRerender()
        await publishItemsUpdate(newItems)
    }, [disabled, allowAdd, maxItems, defaultItem, parsedSchema, publishItemsUpdate, forceRerender])

    // Remove item
    const handleRemoveItem = useCallback(async (index) => {
        if (disabled || !allowRemove) return

        const newItems = itemsRef.current.filter((_, i) => i !== index)

        // Update expanded items set
        setExpandedItems(prev => {
            const newExpanded = new Set()
            prev.forEach(i => {
                if (i < index) {
                    newExpanded.add(i)
                } else if (i > index) {
                    newExpanded.add(i - 1)
                }
            })
            return newExpanded
        })

        // Clear error for this item
        setItemErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors[index]
            return newErrors
        })

        itemsRef.current = newItems
        forceRerender()
        await publishItemsUpdate(newItems)
    }, [disabled, allowRemove, publishItemsUpdate, forceRerender])


    // Move item (for reordering)
    const handleMoveItem = useCallback(async (fromIndex, toIndex) => {
        if (disabled || !allowReorder) return
        if (fromIndex === toIndex) return

        const newItems = [...itemsRef.current]
        const [movedItem] = newItems.splice(fromIndex, 1)
        newItems.splice(toIndex, 0, movedItem)

        // Update expanded items indices
        setExpandedItems(prev => {
            const newExpanded = new Set()
            prev.forEach(i => {
                if (i === fromIndex) {
                    newExpanded.add(toIndex)
                } else if (fromIndex < toIndex) {
                    if (i > fromIndex && i <= toIndex) {
                        newExpanded.add(i - 1)
                    } else {
                        newExpanded.add(i)
                    }
                } else {
                    if (i >= toIndex && i < fromIndex) {
                        newExpanded.add(i + 1)
                    } else {
                        newExpanded.add(i)
                    }
                }
            })
            return newExpanded
        })

        itemsRef.current = newItems
        forceRerender()
        await publishItemsUpdate(newItems)
    }, [disabled, allowReorder, publishItemsUpdate, forceRerender])

    // Validation
    const hasError = validation && !validation.isValid
    const canAddMore = !maxItems || itemsRef.current.length < maxItems
    const needsMore = minItems && itemsRef.current.length < minItems

    return (
        <div className="space-y-1">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Container */}
            <div className={`border rounded-lg overflow-hidden ${hasError ? 'border-red-300' : 'border-gray-300'}`}>
                {/* Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <List className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">
                            {itemsRef.current.length} {itemsRef.current.length === 1 ? 'Item' : 'Items'}
                            {maxItems && ` (max ${maxItems})`}
                            {needsMore && <span className="text-red-600 ml-2">• {minItems - itemsRef.current.length} more required</span>}
                        </span>
                    </div>

                    {/* Add Button in Header */}
                    {allowAdd && canAddMore && !disabled && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            aria-label={addButtonText}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{addButtonText}</span>
                        </button>
                    )}
                </div>

                {/* Items List */}
                <div className="divide-y divide-gray-200">
                    {itemsRef.current.length === 0 ? (
                        <div className="p-8 text-center">
                            <List className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-500 mb-4">{emptyText}</p>
                            {allowAdd && !disabled && (
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{addButtonText}</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        itemsRef.current.map((item, index) => (
                            <ItemCard
                                key={item._itemId || `fallback-${index}`}
                                initialItem={item}
                                index={index}
                                labelTemplate={itemLabelTemplate}
                                isExpanded={expandedItems.has(index)}
                                onToggle={toggleItemExpansion}
                                onRemove={allowRemove ? handleRemoveItem : null}
                                onMoveUp={allowReorder && index > 0 ? handleMoveItem : null}
                                onMoveDown={allowReorder && index < itemsRef.current.length - 1 ? handleMoveItem : null}
                                canMoveUp={allowReorder && index > 0}
                                canMoveDown={allowReorder && index < itemsRef.current.length - 1}
                                schema={parsedSchema}
                                disabled={disabled}
                                errors={itemErrors[index]}
                                widgetId={context?.widgetId}
                                slotName={context?.slotName}
                                contextType={context?.contextType}
                                widgetPath={context?.widgetPath}
                                fieldName={fieldName}
                                parentComponentId={componentId}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600" role="alert">
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

ItemsListField.displayName = 'ItemsListField'

// Memoize to prevent unnecessary re-renders from parent updates
export default React.memo(ItemsListField, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.value === nextProps.value &&
        prevProps.disabled === nextProps.disabled &&
        prevProps.validation === nextProps.validation &&
        prevProps.isValidating === nextProps.isValidating &&
        prevProps.itemSchema === nextProps.itemSchema
    )
})

