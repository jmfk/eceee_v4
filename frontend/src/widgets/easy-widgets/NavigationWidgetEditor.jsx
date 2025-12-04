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
            onConfigChange({
                ...config,
                menuItems: newMenuItems
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
        const newMenuItems = [...menuItems, { url: JSON.stringify(linkData), order: menuItems.length }]
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems)
    }, [menuItems, updateConfig])

    // Remove a menu item
    const removeMenuItem = useCallback((index) => {
        const newMenuItems = menuItems.filter((_, idx) => idx !== index)
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems)
    }, [menuItems, updateConfig])

    // Update a menu item's url field
    const updateMenuItemUrl = useCallback((index, newUrl) => {
        const newMenuItems = [...menuItems]
        newMenuItems[index] = {
            ...newMenuItems[index],
            url: newUrl
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
                                    className="border border-gray-200 rounded bg-white min-w-0"
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.dataTransfer.dropEffect = 'move'
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                                        moveMenuItem(fromIndex, index)
                                    }}
                                >
                                    <div className="flex items-start gap-2 p-2">
                                        <div
                                            className="cursor-move text-gray-400 hover:text-gray-600 flex-shrink-0 pt-3"
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.effectAllowed = 'move'
                                                e.dataTransfer.setData('text/plain', index.toString())
                                            }}
                                        >
                                            <GripVertical size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <LinkField
                                                value={item.url}
                                                onChange={(newUrl) => updateMenuItemUrl(index, newUrl)}
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

