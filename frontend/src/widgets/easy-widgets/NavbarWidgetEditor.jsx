import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, X, Download, FileText, Loader2, GripVertical } from 'lucide-react'
import { usePageChildren } from '../../hooks/usePageStructure'
import LinkField, { parseLinkValue } from '../../components/form-fields/LinkField'

/**
 * NavbarWidgetEditor Component
 * Custom editor for the Navbar widget with subpage import functionality
 * 
 * Uses consolidated LinkField which stores label, isActive, targetBlank
 * in the url field as a JSON object.
 */
const NavbarWidgetEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange,
    context = {}
}) => {
    const config = widgetData?.config || {}
    const [menuItems, setMenuItems] = useState(config.menuItems || [])
    const [secondaryMenuItems, setSecondaryMenuItems] = useState(config.secondaryMenuItems || [])

    // Get current page ID from context
    const currentPageId = useMemo(() => {
        return context?.pageId || context?.webpageData?.id || null
    }, [context])

    // Fetch children pages (including unpublished for navbar configuration)
    const { data: childrenPages = [], isLoading: isLoadingChildren } = usePageChildren(
        currentPageId,
        true // includeUnpublished: true - include unpublished pages for navbar editing
    )

    const [selectedPageIds, setSelectedPageIds] = useState(new Set())
    const [showImportSection, setShowImportSection] = useState(false)

    // Get site root ID for LinkField context
    const siteRootId = useMemo(() => {
        return context?.webpageData?.cachedRootId || context?.siteRootId || null
    }, [context])

    // Sync state when widget config changes externally
    useEffect(() => {
        const items = (config.menuItems || []).map((item, idx) => ({
            ...item,
            order: item.order ?? idx
        }))
        const secItems = (config.secondaryMenuItems || []).map((item, idx) => ({
            ...item,
            order: item.order ?? idx
        }))
        setMenuItems(items)
        setSecondaryMenuItems(secItems)
    }, [config.menuItems, config.secondaryMenuItems])

    // Helper to update config
    const updateConfig = useCallback((newMenuItems, newSecondaryMenuItems) => {
        if (onConfigChange) {
            onConfigChange({
                ...config,
                menuItems: newMenuItems,
                secondaryMenuItems: newSecondaryMenuItems !== undefined ? newSecondaryMenuItems : config.secondaryMenuItems
            })
        }
    }, [config, onConfigChange])

    // Toggle page selection
    const togglePageSelection = useCallback((pageId) => {
        setSelectedPageIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(pageId)) {
                newSet.delete(pageId)
            } else {
                newSet.add(pageId)
            }
            return newSet
        })
    }, [])

    // Import selected pages as menu items
    const importSelectedPages = useCallback(() => {
        if (selectedPageIds.size === 0) return

        const newMenuItems = [...menuItems]

        // Get selected pages from childrenPages
        const selectedPages = childrenPages.filter(child =>
            selectedPageIds.has(child.page.id)
        )

        // Convert each selected page to a menu item with consolidated link data
        selectedPages.forEach(child => {
            const page = child.page
            const pageVersion = child.currentVersion

            // Use page title as label, fallback to slug
            const label = pageVersion?.title || page.title || page.slug || `Page ${page.id}`

            // Check if menu item already exists (by pageId or label)
            const exists = newMenuItems.some(item => {
                const linkData = parseLinkValue(item.url)
                return linkData?.pageId === page.id || linkData?.label === label
            })

            if (!exists) {
                // Create consolidated link object
                const linkData = {
                    type: 'internal',
                    pageId: page.id,
                    label: label,
                    isActive: true,
                    targetBlank: false
                }
                newMenuItems.push({
                    url: JSON.stringify(linkData),
                    order: newMenuItems.length
                })
            }
        })

        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
        setSelectedPageIds(new Set()) // Clear selection after import
    }, [selectedPageIds, childrenPages, menuItems, updateConfig])

    // Select all pages
    const selectAllPages = useCallback(() => {
        setSelectedPageIds(new Set(childrenPages.map(child => child.page.id)))
    }, [childrenPages])

    // Deselect all pages
    const deselectAllPages = useCallback(() => {
        setSelectedPageIds(new Set())
    }, [])

    // Add a new menu item
    const addMenuItem = useCallback(() => {
        const linkData = {
            label: '',
            isActive: true,
            targetBlank: false
        }
        const newMenuItems = [...menuItems, { url: JSON.stringify(linkData), order: menuItems.length }]
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Remove a menu item
    const removeMenuItem = useCallback((index) => {
        const newMenuItems = menuItems.filter((_, idx) => idx !== index)
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Update a menu item's url field (contains all link data)
    const updateMenuItemUrl = useCallback((index, newUrl) => {
        const newMenuItems = [...menuItems]
        newMenuItems[index] = {
            ...newMenuItems[index],
            url: newUrl
        }
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Add a new secondary menu item
    const addSecondaryMenuItem = useCallback(() => {
        const linkData = {
            label: '',
            isActive: true,
            targetBlank: false
        }
        const newSecondaryMenuItems = [...secondaryMenuItems, {
            url: JSON.stringify(linkData),
            order: secondaryMenuItems.length
        }]
        setSecondaryMenuItems(newSecondaryMenuItems)
        updateConfig(menuItems, newSecondaryMenuItems)
    }, [secondaryMenuItems, menuItems, updateConfig])

    // Remove a secondary menu item
    const removeSecondaryMenuItem = useCallback((index) => {
        const newSecondaryMenuItems = secondaryMenuItems.filter((_, idx) => idx !== index)
        setSecondaryMenuItems(newSecondaryMenuItems)
        updateConfig(menuItems, newSecondaryMenuItems)
    }, [secondaryMenuItems, menuItems, updateConfig])

    // Update a secondary menu item's url field
    const updateSecondaryMenuItemUrl = useCallback((index, newUrl) => {
        const newSecondaryMenuItems = [...secondaryMenuItems]
        newSecondaryMenuItems[index] = {
            ...newSecondaryMenuItems[index],
            url: newUrl
        }
        setSecondaryMenuItems(newSecondaryMenuItems)
        updateConfig(menuItems, newSecondaryMenuItems)
    }, [secondaryMenuItems, menuItems, updateConfig])

    // Update a secondary menu item's extra field (backgroundColor, backgroundImage)
    const updateSecondaryMenuItemField = useCallback((index, field, value) => {
        const newSecondaryMenuItems = [...secondaryMenuItems]
        newSecondaryMenuItems[index] = {
            ...newSecondaryMenuItems[index],
            [field]: value
        }
        setSecondaryMenuItems(newSecondaryMenuItems)
        updateConfig(menuItems, newSecondaryMenuItems)
    }, [secondaryMenuItems, menuItems, updateConfig])

    // Move menu item
    const moveMenuItem = useCallback((fromIndex, toIndex) => {
        const items = [...menuItems]
        const [movedItem] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, movedItem)
        const reordered = items.map((item, idx) => ({ ...item, order: idx }))
        setMenuItems(reordered)
        updateConfig(reordered, undefined)
    }, [menuItems, updateConfig])

    // Move secondary menu item
    const moveSecondaryMenuItem = useCallback((fromIndex, toIndex) => {
        const items = [...secondaryMenuItems]
        const [movedItem] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, movedItem)
        const reordered = items.map((item, idx) => ({ ...item, order: idx }))
        setSecondaryMenuItems(reordered)
        updateConfig(menuItems, reordered)
    }, [secondaryMenuItems, menuItems, updateConfig])

    return (
        <div className="h-full flex flex-col overflow-hidden min-w-0">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold">Navbar Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Configure menu items and import subpages
                </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-6">
                {/* Import Subpages Section */}
                {showImportSection && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="min-w-0 flex-1 mr-2">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <FileText size={18} />
                                    Import Subpages
                                </h3>
                                <p className="text-xs text-gray-600 mt-1">
                                    {currentPageId
                                        ? `Select subpages of the current page to add as menu items (includes unpublished pages)`
                                        : 'Select a page to view its subpages'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowImportSection(false)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Hide import section"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {!currentPageId ? (
                            <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p>No page context available. This widget should be used within a page editor.</p>
                            </div>
                        ) : isLoadingChildren ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="animate-spin text-gray-400" />
                                <span className="ml-2 text-sm text-gray-600">Loading subpages...</span>
                            </div>
                        ) : childrenPages.length === 0 ? (
                            <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
                                <p>This page has no subpages. Create child pages to import them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Selection controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllPages}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-gray-400">|</span>
                                        <button
                                            type="button"
                                            onClick={deselectAllPages}
                                            className="text-xs text-gray-600 hover:text-gray-800"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                    <span className="text-xs text-gray-600">
                                        {selectedPageIds.size} of {childrenPages.length} selected
                                    </span>
                                </div>

                                {/* Page list */}
                                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded bg-white min-w-0">
                                    {childrenPages.map((child) => {
                                        const page = child.page
                                        const pageVersion = child.currentVersion
                                        const isSelected = selectedPageIds.has(page.id)
                                        const title = pageVersion?.title || page.title || page.slug || `Page ${page.id}`

                                        return (
                                            <label
                                                key={page.id}
                                                className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 min-w-0 ${isSelected ? 'bg-blue-50' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => togglePageSelection(page.id)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 truncate">
                                                        {title}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">
                                                        /{page.slug || 'no-slug'}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>

                                {/* Import button */}
                                <button
                                    type="button"
                                    onClick={importSelectedPages}
                                    disabled={selectedPageIds.size === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                    <Download size={16} />
                                    Import Selected Pages ({selectedPageIds.size})
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Show import section button if hidden */}
                {!showImportSection && (
                    <button
                        type="button"
                        onClick={() => setShowImportSection(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-700"
                    >
                        <FileText size={16} />
                        Show Import Subpages
                    </button>
                )}

                {/* Primary Menu Items */}
                <div className="min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Primary Menu Items</h3>
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
                                                labelPlaceholder="Menu item label"
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
                            No menu items yet. Add items manually or import subpages above.
                        </p>
                    )}
                </div>

                {/* Secondary Menu Items */}
                <div className="min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Secondary Menu Items</h3>
                        <button
                            type="button"
                            onClick={addSecondaryMenuItem}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex-shrink-0"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    </div>

                    {secondaryMenuItems.length > 0 ? (
                        <div className="space-y-2 min-w-0">
                            {secondaryMenuItems.map((item, index) => (
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
                                        moveSecondaryMenuItem(fromIndex, index)
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
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <LinkField
                                                value={item.url}
                                                onChange={(newUrl) => updateSecondaryMenuItemUrl(index, newUrl)}
                                                currentPageId={currentPageId}
                                                currentSiteRootId={siteRootId}
                                                currentSiteId={siteRootId}
                                                labelPlaceholder="Menu item label"
                                            />
                                            {/* Extra fields for secondary items */}
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">
                                                        Background Color
                                                    </label>
                                                    <input
                                                        type="color"
                                                        value={item.backgroundColor || '#3b82f6'}
                                                        onChange={(e) => updateSecondaryMenuItemField(index, 'backgroundColor', e.target.value)}
                                                        className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">
                                                        Background Image
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.backgroundImage || ''}
                                                        onChange={(e) => updateSecondaryMenuItemField(index, 'backgroundImage', e.target.value)}
                                                        placeholder="URL..."
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeSecondaryMenuItem(index)}
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
                            No secondary menu items yet.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Define metadata for editor registration
NavbarWidgetEditor.displayName = 'NavbarWidgetEditor'
NavbarWidgetEditor.forWidgetType = 'easy_widgets.NavbarWidget'

export default NavbarWidgetEditor
