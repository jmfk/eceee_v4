/**
 * WidgetLibraryPanel - Widget picker and library interface
 * 
 * Provides a searchable, categorized interface for selecting and adding
 * widgets to slots, with support for both page and object contexts.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { Search, Plus, Grid, List, Filter, X, Package, Zap, Image, Type } from 'lucide-react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext } from '../context/EditorContext'
import {
    WIDGET_TYPE_REGISTRY,
    getWidgetsByCategory,
    getWidgetCategories,
    createWidget
} from '../utils/widgetFactory'

/**
 * Widget category icons mapping
 */
const CATEGORY_ICONS = {
    content: Type,
    media: Image,
    interactive: Zap,
    layout: Grid,
    advanced: Package,
    data: List
}

/**
 * WidgetLibraryPanel Component
 */
export function WidgetLibraryPanel({
    isOpen = false,
    onClose,
    onWidgetSelect,
    targetSlot = null,
    slotConfig = {},
    className = '',
    position = 'left' // 'left' or 'right'
}) {
    const { context, addWidget, getAvailableWidgetTypes } = useWidgetContext()
    const { toggleWidgetLibrary } = useEditorContext()

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
    const [showFilters, setShowFilters] = useState(false)

    // Get available widget types for current context and slot
    const availableTypes = useMemo(() => {
        const contextTypes = getAvailableWidgetTypes(slotConfig)

        // For object context, return the structured types
        if (context === 'object' && Array.isArray(contextTypes) && contextTypes.length > 0 && contextTypes[0].controlId) {
            return contextTypes
        }

        // For page context or fallback, return all widget types
        return Object.entries(WIDGET_TYPE_REGISTRY).map(([slug, type]) => ({
            slug,
            ...type
        }))
    }, [context, slotConfig, getAvailableWidgetTypes])

    // Filter widgets based on search and category
    const filteredWidgets = useMemo(() => {
        let filtered = availableTypes

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(widget =>
                widget.name.toLowerCase().includes(term) ||
                widget.description?.toLowerCase().includes(term) ||
                widget.category?.toLowerCase().includes(term)
            )
        }

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(widget =>
                widget.category === selectedCategory
            )
        }

        return filtered
    }, [availableTypes, searchTerm, selectedCategory])

    // Get unique categories from available widgets
    const categories = useMemo(() => {
        const categorySet = new Set()
        availableTypes.forEach(widget => {
            if (widget.category) {
                categorySet.add(widget.category)
            }
        })
        return Array.from(categorySet).sort()
    }, [availableTypes])

    /**
     * Handle widget selection
     */
    const handleWidgetSelect = useCallback(async (widgetType) => {
        if (!targetSlot) {
            console.warn('No target slot specified')
            return
        }

        try {
            // Create widget instance
            const widget = createWidget(widgetType.slug, {
                context,
                controlId: widgetType.controlId // For object context
            })

            // Add to slot
            const result = await addWidget(targetSlot, widget, slotConfig)

            if (result.success) {
                // Notify parent component
                if (onWidgetSelect) {
                    onWidgetSelect(widget, targetSlot)
                }

                // Close library panel
                toggleWidgetLibrary(false)
            } else {
                console.error('Failed to add widget:', result.error)
            }
        } catch (error) {
            console.error('Error creating widget:', error)
        }
    }, [targetSlot, context, addWidget, slotConfig, onWidgetSelect, toggleWidgetLibrary])

    /**
     * Clear all filters
     */
    const clearFilters = useCallback(() => {
        setSearchTerm('')
        setSelectedCategory('')
    }, [])

    if (!isOpen) {
        return null
    }

    const positionClasses = position === 'right'
        ? 'inset-y-0 right-0'
        : 'inset-y-0 left-0'

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={onClose} />

            {/* Panel */}
            <div className={`fixed ${positionClasses} w-80 bg-white shadow-xl z-50 flex flex-col ${className}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-medium text-gray-900">Widget Library</h3>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-md transition-colors ${showFilters || selectedCategory || searchTerm
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            title="Toggle filters"
                        >
                            <Filter className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                        >
                            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="space-y-3">
                            {/* Category Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Category
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Clear Filters */}
                            {(searchTerm || selectedCategory) && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Context Info */}
                {targetSlot && (
                    <div className="px-4 py-2 bg-blue-50 border-b">
                        <div className="text-xs text-blue-800">
                            Adding to: <span className="font-medium">{targetSlot}</span>
                            {context === 'object' && <span className="ml-2 px-2 py-1 bg-blue-200 rounded">Object</span>}
                            {context === 'page' && <span className="ml-2 px-2 py-1 bg-green-200 rounded">Page</span>}
                        </div>
                    </div>
                )}

                {/* Widget Grid/List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredWidgets.length > 0 ? (
                        <div className={`${viewMode === 'grid'
                                ? 'grid grid-cols-2 gap-3'
                                : 'space-y-2'
                            }`}>
                            {filteredWidgets.map((widget) => (
                                <WidgetCard
                                    key={widget.controlId || widget.slug}
                                    widget={widget}
                                    viewMode={viewMode}
                                    onSelect={() => handleWidgetSelect(widget)}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            hasFilters={!!(searchTerm || selectedCategory)}
                            onClearFilters={clearFilters}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 text-center">
                        {filteredWidgets.length} of {availableTypes.length} widgets available
                    </div>
                </div>
            </div>
        </>
    )
}

/**
 * Widget Card Component
 */
function WidgetCard({ widget, viewMode, onSelect }) {
    const IconComponent = CATEGORY_ICONS[widget.category] || Package

    if (viewMode === 'list') {
        return (
            <button
                onClick={onSelect}
                className="w-full flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
                <div className="flex-shrink-0">
                    <IconComponent className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                        {widget.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {widget.description}
                    </div>
                </div>
                <Plus className="h-4 w-4 text-gray-400" />
            </button>
        )
    }

    return (
        <button
            onClick={onSelect}
            className="w-full p-3 text-center border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
        >
            <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <IconComponent className="h-6 w-6 text-gray-500 group-hover:text-blue-600" />
                </div>

                <div>
                    <div className="font-medium text-xs text-gray-900 truncate">
                        {widget.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {widget.description}
                    </div>
                </div>

                <Plus className="h-3 w-3 text-gray-400 group-hover:text-blue-600" />
            </div>
        </button>
    )
}

/**
 * Empty State Component
 */
function EmptyState({ hasFilters, onClearFilters }) {
    return (
        <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />

            {hasFilters ? (
                <>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No widgets match your filters
                    </h4>
                    <p className="text-gray-500 mb-4">
                        Try adjusting your search terms or category filter.
                    </p>
                    <button
                        onClick={onClearFilters}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        Clear all filters
                    </button>
                </>
            ) : (
                <>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No widgets available
                    </h4>
                    <p className="text-gray-500">
                        There are no widgets available for this slot configuration.
                    </p>
                </>
            )}
        </div>
    )
}

export default WidgetLibraryPanel
