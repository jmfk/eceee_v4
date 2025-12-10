import React, { useState, useMemo } from 'react'
import {
    Grid3X3,
    Search,
    X,
    Eye
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

// API
import { layoutsApi } from '../api/layouts'

const LayoutEditor = ({
    onSelect,
    selectedLayout = null,
    showPreview = true,
    className = "",
    mode = "view" // "view" | "select"
}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedLayoutForPreview, setSelectedLayoutForPreview] = useState(null)

    // Fetch code layouts
    const { data: codeLayoutsData, isLoading } = useQuery({
        queryKey: ['code-layouts'],
        queryFn: () => layoutsApi.codeLayouts.list(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Combine and format layouts
    const layouts = useMemo(() => {
        const allLayouts = []

        // Add code layouts
        if (codeLayoutsData?.results) {
            const codeLayouts = codeLayoutsData.results.map(layout => ({
                ...layout,
                type: 'code',
                displayName: layout.name,
                source: 'Code-based'
            }))
            allLayouts.push(...codeLayouts)
        }

        return allLayouts
    }, [codeLayoutsData])

    // Filter layouts based on search
    const filteredLayouts = useMemo(() => {
        if (!searchTerm.trim()) return layouts

        const term = searchTerm.toLowerCase()
        return layouts.filter(layout =>
            layout.name.toLowerCase().includes(term) ||
            layout.description?.toLowerCase().includes(term) ||
            layout.source.toLowerCase().includes(term)
        )
    }, [layouts, searchTerm])

    const handleLayoutSelect = (layout) => {
        if (mode === "select" && onSelect) {
            onSelect(layout)
        } else {
            setSelectedLayoutForPreview(layout)
        }
    }

    const closePreview = () => {
        setSelectedLayoutForPreview(null)
    }

    if (isLoading) {
        return (
            <div className={`layout-editor ${className}`}>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading layouts...</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`layout-editor bg-white ${className}`}>
            {/* Header */}
            <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xl font-semibold text-gray-900 flex items-center" role="heading" aria-level="2">
                            <Grid3X3 className="h-6 w-6 mr-2 text-blue-600" />
                            Layout Templates
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                            View and manage code-based layout templates
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search layouts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Layouts Grid */}
            <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">
                        Code-based Layouts
                    </div>
                    <span className="text-sm text-gray-500">
                        Code-based layout templates
                    </span>
                </div>

                {filteredLayouts.length === 0 ? (
                    <div className="text-center py-8">
                        <Grid3X3 className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-2 text-sm font-medium text-gray-900" role="heading" aria-level="3">No layouts found</div>
                        <div className="mt-1 text-sm text-gray-500">
                            {searchTerm ? 'Try adjusting your search terms.' : 'No layouts have been defined.'}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLayouts.map((layout) => (
                            <LayoutCard
                                key={layout.name}
                                layout={layout}
                                isSelected={selectedLayout?.name === layout.name}
                                onSelect={() => handleLayoutSelect(layout)}
                                onPreview={showPreview ? () => setSelectedLayoutForPreview(layout) : null}
                                mode={mode}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Layout Preview Modal */}
            {selectedLayoutForPreview && showPreview && (
                <LayoutPreviewModal
                    layout={selectedLayoutForPreview}
                    onClose={closePreview}
                />
            )}
        </div>
    )
}

// Layout Card Component
const LayoutCard = ({ layout, isSelected, onSelect, onPreview, mode }) => {
    const slotCount = layout.slotConfiguration?.slots?.length || 0

    return (
        <div
            className={`layout-card border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${isSelected
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            onClick={onSelect}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate" role="heading" aria-level="4">
                        {layout.displayName || layout.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        📝 Code Layout
                    </div>
                </div>
                {onPreview && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onPreview()
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Preview layout"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Description */}
            {layout.description && (
                <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {layout.description}
                </div>
            )}

            {/* Metadata */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Slots</span>
                    <span className="font-medium">{slotCount}</span>
                </div>

                {layout.template_name && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Template</span>
                        <span className="font-mono truncate max-w-32" title={layout.template_name}>
                            {layout.template_name}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${layout.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}>
                        {layout.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            {/* Selection indicator */}
            {mode === "select" && isSelected && (
                <div className="mt-3 flex items-center text-blue-600 text-sm font-medium">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                    Selected
                </div>
            )}
        </div>
    )
}

// Layout Preview Modal
const LayoutPreviewModal = ({ layout, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                            {layout.name}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            📝 Code Layout Preview
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Basic Info */}
                    <div className="mb-6">
                        <div className="text-sm font-medium text-gray-900 mb-2" role="heading" aria-level="4">Layout Information</div>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-medium">{layout.name}</span>
                            </div>
                            {layout.description && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Description:</span>
                                    <span className="font-medium text-right max-w-xs">{layout.description}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Type:</span>
                                <span className="font-medium">Code-based</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Status:</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${layout.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {layout.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Slots Configuration */}
                    {layout.slotConfiguration?.slots && layout.slotConfiguration.slots.length > 0 && (
                        <div>
                            <div className="text-sm font-medium text-gray-900 mb-2" role="heading" aria-level="4">
                                Widget Slots ({layout.slotConfiguration.slots.length})
                            </div>
                            <div className="space-y-3">
                                {layout.slotConfiguration.slots.map((slot, index) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-sm text-gray-900">
                                                {slot.title || slot.name}
                                            </span>
                                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                                {slot.name}
                                            </span>
                                        </div>
                                        {slot.description && (
                                            <div className="text-xs text-gray-600 mb-2">
                                                {slot.description}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>
                                                Max widgets: {slot.max_widgets || 'Unlimited'}
                                            </span>
                                            {slot.css_classes && (
                                                <span className="font-mono">
                                                    {slot.css_classes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default LayoutEditor 