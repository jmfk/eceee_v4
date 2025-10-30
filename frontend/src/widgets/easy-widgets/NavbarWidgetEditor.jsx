import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, X, Download, FileText, Loader2, GripVertical } from 'lucide-react'
import { usePageChildren } from '../../hooks/usePageStructure'
import { pagesApi } from '../../api'

/**
 * NavbarWidgetEditor Component
 * Custom editor for the Navbar widget with subpage import functionality
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
    const { data: childrenPages = [], isLoading: isLoadingChildren, refetch: refetchChildren } = usePageChildren(
        currentPageId,
        true // includeUnpublished: true - include unpublished pages for navbar editing
    )

    const [selectedPageIds, setSelectedPageIds] = useState(new Set())
    const [showImportSection, setShowImportSection] = useState(false)

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

        // Convert each selected page to a menu item
        selectedPages.forEach(child => {
            const page = child.page
            const pageVersion = child.currentVersion

            // Generate URL from page slug path
            const url = page.slug ? `/${page.slug}/` : `#page-${page.id}`

            // Use page title as label, fallback to slug
            const label = pageVersion?.title || page.title || page.slug || `Page ${page.id}`

            // Check if menu item already exists (by URL or label)
            const exists = newMenuItems.some(item =>
                item.url === url || item.label === label
            )

            if (!exists) {
                newMenuItems.push({
                    label: label,
                    url: url,
                    targetBlank: false,
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
        const newMenuItems = [...menuItems, { label: '', url: '', targetBlank: false, order: menuItems.length }]
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Remove a menu item
    const removeMenuItem = useCallback((index) => {
        const newMenuItems = menuItems.filter((_, idx) => idx !== index)
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Update a menu item
    const updateMenuItem = useCallback((index, field, value) => {
        const newMenuItems = [...menuItems]
        newMenuItems[index] = {
            ...newMenuItems[index],
            [field]: value
        }
        setMenuItems(newMenuItems)
        updateConfig(newMenuItems, undefined)
    }, [menuItems, updateConfig])

    // Add a new secondary menu item
    const addSecondaryMenuItem = useCallback(() => {
        const newSecondaryMenuItems = [...secondaryMenuItems, {
            label: '',
            url: '',
            targetBlank: false,
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

    // Update a secondary menu item
    const updateSecondaryMenuItem = useCallback((index, field, value) => {
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
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold">Navbar Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Configure menu items and import subpages
                </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Import Subpages Section */}
                {showImportSection && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                            <div>
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
                                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded bg-white">
                                    {childrenPages.map((child) => {
                                        const page = child.page
                                        const pageVersion = child.currentVersion
                                        const isSelected = selectedPageIds.has(page.id)
                                        const title = pageVersion?.title || page.title || page.slug || `Page ${page.id}`

                                        return (
                                            <label
                                                key={page.id}
                                                className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => togglePageSelection(page.id)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Primary Menu Items</h3>
                        <button
                            type="button"
                            onClick={addMenuItem}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    </div>

                    {menuItems.length > 0 ? (
                        <div className="space-y-2">
                            {menuItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="border border-gray-200 rounded p-3 bg-white space-y-2"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move'
                                        e.dataTransfer.setData('text/plain', index)
                                    }}
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
                                    <div className="flex items-start gap-2">
                                        <div className="cursor-move text-gray-400 hover:text-gray-600 flex-shrink-0 pt-1">
                                            <GripVertical size={18} />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="text"
                                                value={item.label || ''}
                                                onChange={(e) => updateMenuItem(index, 'label', e.target.value)}
                                                placeholder="Label *"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                value={item.url || ''}
                                                onChange={(e) => updateMenuItem(index, 'url', e.target.value)}
                                                placeholder="URL *"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.isActive !== false}
                                                        onChange={(e) => updateMenuItem(index, 'isActive', e.target.checked)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Active
                                                </label>
                                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.targetBlank || false}
                                                        onChange={(e) => updateMenuItem(index, 'targetBlank', e.target.checked)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Open in new tab
                                                </label>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeMenuItem(index)}
                                            className="text-red-600 hover:text-red-800 flex-shrink-0"
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
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Secondary Menu Items</h3>
                        <button
                            type="button"
                            onClick={addSecondaryMenuItem}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    </div>

                    {secondaryMenuItems.length > 0 ? (
                        <div className="space-y-2">
                            {secondaryMenuItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="border border-gray-200 rounded p-3 bg-white space-y-2"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move'
                                        e.dataTransfer.setData('text/plain', index)
                                    }}
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
                                    <div className="flex items-start gap-2">
                                        <div className="cursor-move text-gray-400 hover:text-gray-600 flex-shrink-0 pt-1">
                                            <GripVertical size={18} />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="text"
                                                value={item.label || ''}
                                                onChange={(e) => updateSecondaryMenuItem(index, 'label', e.target.value)}
                                                placeholder="Label *"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="text"
                                                value={item.url || ''}
                                                onChange={(e) => updateSecondaryMenuItem(index, 'url', e.target.value)}
                                                placeholder="URL *"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.isActive !== false}
                                                        onChange={(e) => updateSecondaryMenuItem(index, 'isActive', e.target.checked)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Active
                                                </label>
                                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.targetBlank || false}
                                                        onChange={(e) => updateSecondaryMenuItem(index, 'targetBlank', e.target.checked)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Open in new tab
                                                </label>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">
                                                    Background Color
                                                </label>
                                                <input
                                                    type="color"
                                                    value={item.backgroundColor || '#3b82f6'}
                                                    onChange={(e) => updateSecondaryMenuItem(index, 'backgroundColor', e.target.value)}
                                                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">
                                                    Background Image URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.backgroundImage || ''}
                                                    onChange={(e) => updateSecondaryMenuItem(index, 'backgroundImage', e.target.value)}
                                                    placeholder="https://example.com/image.jpg"
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeSecondaryMenuItem(index)}
                                            className="text-red-600 hover:text-red-800 flex-shrink-0"
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
