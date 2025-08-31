import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Search,
    Type,
    Image,
    MousePointer,
    Space,
    Code,
    Plus,
    Grid3X3,
    Filter,
    Newspaper,
    Calendar,
    Users,
    FileText,
    ImageIcon,
    Package,
    Eye,
    EyeOff,
    Settings,
    Info,
    ExternalLink,
    CheckCircle,
    XCircle,
    AlertCircle,
    Layers
} from 'lucide-react'
import { widgetsApi } from '../api'

const WidgetManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState('all')
    const [showInactive, setShowInactive] = useState(false)

    // Fetch all widget types (both active and inactive)
    const { data: widgetTypes, isLoading, error } = useQuery({
        queryKey: ['widget-types', showInactive],
        queryFn: async () => {
            const response = await widgetsApi.getTypes()
            return response || []
        }
    })

    // Widget type icons mapping
    const getWidgetIcon = (widgetName) => {
        switch (widgetName.toLowerCase()) {
            case 'text block':
                return Type
            case 'image':
                return Image
            case 'button':
                return MousePointer
            case 'spacer':
                return Space
            case 'html block':
                return Code
            case 'news':
                return Newspaper
            case 'event':
                return Calendar
            case 'team':
                return Users
            case 'article':
                return FileText
            case 'gallery':
                return ImageIcon
            case 'layout':
                return Layers
            default:
                return Package
        }
    }

    // Simple categorization of widgets
    const getCategoryForWidget = (widgetName) => {
        const name = widgetName.toLowerCase()
        if (['text block', 'html block', 'article'].includes(name)) return 'content'
        if (['image', 'gallery'].includes(name)) return 'media'
        if (['button', 'spacer'].includes(name)) return 'layout'
        if (['news', 'event', 'team'].includes(name)) return 'dynamic'
        return 'other'
    }

    // Filter widget types based on search and category
    const filteredWidgetTypes = widgetTypes?.filter(widget => {
        // Filter by active status
        if (!showInactive && !widget.isActive) {
            return false
        }

        // Filter by search term
        const matchesSearch = searchTerm === '' ||
            widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            widget.description.toLowerCase().includes(searchTerm.toLowerCase())

        // Filter by category - for now we'll use a simple categorization
        const category = getCategoryForWidget(widget.name)
        const matchesCategory = filterCategory === 'all' || category === filterCategory

        return matchesSearch && matchesCategory
    }) || []

    const categories = [
        { id: 'all', label: 'All Widgets' },
        { id: 'content', label: 'Content' },
        { id: 'media', label: 'Media' },
        { id: 'layout', label: 'Layout' },
        { id: 'dynamic', label: 'Dynamic' },
        { id: 'other', label: 'Other' }
    ]

    const getStatusIcon = (isActive) => {
        return isActive ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
            <XCircle className="w-4 h-4 text-red-500" />
        )
    }

    const getStatusText = (isActive) => {
        return isActive ? 'Active' : 'Inactive'
    }

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                        <span className="text-red-700">Failed to load widget types</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Widget Types</h2>
                <p className="text-gray-600 mt-1">
                    Manage and view all registered widget types in the system
                </p>
            </div>

            {/* Controls */}
            <div className="mb-6 space-y-4">
                {/* Search and Toggle */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search widgets by name or description..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <label className="flex items-center space-x-2 whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Show inactive</span>
                    </label>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setFilterCategory(category.id)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCategory === category.id
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Summary */}
            <div className="mb-4 text-sm text-gray-600">
                Showing {filteredWidgetTypes.length} of {widgetTypes?.length || 0} widget types
            </div>

            {/* Widget Types Grid */}
            <div className="grid gap-4">
                {filteredWidgetTypes.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No widget types found</h3>
                        <p className="text-gray-500">
                            {searchTerm || filterCategory !== 'all'
                                ? 'Try adjusting your search or filter criteria.'
                                : 'No widget types are currently registered in the system.'
                            }
                        </p>
                    </div>
                ) : (
                    filteredWidgetTypes.map((widget) => {
                        const IconComponent = getWidgetIcon(widget.name)
                        return (
                            <div
                                key={widget.slug}
                                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3 flex-1">
                                        {/* Widget Icon */}
                                        <div className="flex-shrink-0">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <IconComponent className="w-5 h-5 text-blue-600" />
                                            </div>
                                        </div>

                                        {/* Widget Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h3 className="text-lg font-medium text-gray-900 truncate">
                                                    {widget.name}
                                                </h3>
                                                <div className="flex items-center space-x-1">
                                                    {getStatusIcon(widget.isActive)}
                                                    <span className={`text-xs font-medium ${widget.isActive ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                        {getStatusText(widget.isActive)}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-gray-600 text-sm mb-2">
                                                {widget.description || 'No description provided'}
                                            </p>

                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                    Slug: {widget.slug}
                                                </span>
                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                    Category: {getCategoryForWidget(widget.name)}
                                                </span>
                                                {widget.templateName && (
                                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                        Template: {widget.templateName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 ml-4">
                                        <div className="flex items-center space-x-2">
                                            {widget.hasConfigurationModel && (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                    Configurable
                                                </span>
                                            )}
                                            {widget.templateJson && (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    Template JSON
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Details */}
                                {(widget.configurationSchema || widget.templateJson) && (
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                                            {widget.configurationSchema && (
                                                <div>
                                                    <span className="font-medium">Configuration Fields:</span>
                                                    <div className="mt-1">
                                                        {Object.keys(widget.configurationSchema.properties || {}).length} fields
                                                    </div>
                                                </div>
                                            )}
                                            {widget.templateJson && (
                                                <div>
                                                    <span className="font-medium">Template Features:</span>
                                                    <div className="mt-1">
                                                        {widget.templateJson.slots ? `${widget.templateJson.slots.length} slots` : 'No slots'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

export default WidgetManager
