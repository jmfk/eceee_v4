import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import LinkField from '../../components/form-fields/LinkField'

/**
 * NavigationWidgetEditor Component
 * Custom editor for the Navigation widget with draggable menu items
 */
const NavigationWidgetEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange,
    context = {}
}) => {
    const config = widgetData?.config || {}
    const [menuItems, setMenuItems] = useState(config.menuItems || [])
    const [draggedItemIndex, setDraggedItemIndex] = useState(null)
    const [dropTargetIndex, setDropTargetIndex] = useState(null)

    const currentPageId = useMemo(() => {
        return context?.pageId || context?.webpageData?.id || null
    }, [context])

    const siteRootId = useMemo(() => {
        return context?.webpageData?.cachedRootId || context?.siteRootId || null
    }, [context])

    // Sync state when widget config changes externally
    useEffect(() => {
        const items = (config.menuItems || []).map((item, idx) => ({
            ...item,
            order: item.order ?? idx
        }))
        setMenuItems(items)
    }, [config.menuItems])

    // Helper to update config
    const updateConfig = useCallback((newMenuItems) => {
        if (onConfigChange) {
            // Clean up: remove legacy top-level fields (url, targetBlank, label)
            // These should only exist inside linkData
            const cleanedItems = newMenuItems.map(item => {
                const { url, targetBlank, label, ...cleanItem } = item
                return cleanItem
            })
            onConfigChange({
                ...config,
                menuItems: cleanedItems
            })
        }
    }, [config, onConfigChange])

    // Add a new menu item
    const addMenuItem = useCallback(() => {
        const linkData = {
            label: '',
            isActive: true,
            targetBlank: false
        }
        const newMenuItems = [...menuItems, { linkData: linkData, order: menuItems.length }]
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems)
    }, [menuItems, updateConfig])

    // Remove a menu item
    const removeMenuItem = useCallback((index) => {
        const newMenuItems = menuItems.filter((_, idx) => idx !== index)
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems)
    }, [menuItems, updateConfig])

    // Update a menu item's linkData field
    const updateMenuItemLinkData = useCallback((index, newLinkData) => {
        const newMenuItems = [...menuItems]
        newMenuItems[index] = {
            ...newMenuItems[index],
            linkData: newLinkData
        }
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems)
    }, [menuItems, updateConfig])

    // Move menu item (drag & drop)
    const moveMenuItem = useCallback((fromIndex, toIndex) => {
        const items = [...menuItems]
        const [movedItem] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, movedItem)
        const reordered = items.map((item, idx) => ({ ...item, order: idx }))
        setMenuItems(reordered)
        updateConfig(reordered)
    }, [menuItems, updateConfig])

    return (
        <div className="h-full flex flex-col overflow-hidden min-w-0">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold">Navigation Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Configure navigation menu items
                </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-6">
                {/* Menu Items */}
                <div className="min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Menu Items</h3>
                        <button
                            type="button"
                            onClick={addMenuItem}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex-shrink-0"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    </div>

                    {menuItems.length > 0 ? (
                        <div className="space-y-2 min-w-0">
                            {menuItems.map((item, index) => (
                                <div
                                    key={index}
                                    draggable
                                    className={`border rounded bg-white min-w-0 cursor-move transition-all ${draggedItemIndex === index
                                            ? 'opacity-50 border-blue-400'
                                            : dropTargetIndex === index
                                                ? 'border-blue-500 border-2'
                                                : 'border-gray-200'
                                        }`}
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move'
                                        e.dataTransfer.setData('text/plain', index.toString())
                                        setDraggedItemIndex(index)
                                    }}
                                    onDragEnd={() => {
                                        setDraggedItemIndex(null)
                                        setDropTargetIndex(null)
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.dataTransfer.dropEffect = 'move'
                                        setDropTargetIndex(index)
                                    }}
                                    onDragLeave={() => {
                                        setDropTargetIndex(null)
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                                        moveMenuItem(fromIndex, index)
                                        setDraggedItemIndex(null)
                                        setDropTargetIndex(null)
                                    }}
                                >
                                    <div className="flex items-start gap-2 p-2">
                                        <div className="text-gray-400 flex-shrink-0 pt-3">
                                            <GripVertical size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <LinkField
                                                value={item.linkData}
                                                onChange={(newLinkData) => updateMenuItemLinkData(index, newLinkData)}
                                                currentPageId={currentPageId}
                                                currentSiteRootId={siteRootId}
                                                currentSiteId={siteRootId}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeMenuItem(index)}
                                            className="text-red-600 hover:text-red-800 flex-shrink-0 pt-3"
                                            title="Remove item"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 border border-gray-200 rounded">
                            No menu items yet. Add items using the button above.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

NavigationWidgetEditor.displayName = 'NavigationWidgetEditor'
NavigationWidgetEditor.forWidgetType = 'easy_widgets.NavigationWidget'

export default NavigationWidgetEditor

