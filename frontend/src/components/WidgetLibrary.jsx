import { useState } from 'react'
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
    ImageIcon
} from 'lucide-react'
import { api } from '../api/client'

const WidgetLibrary = ({ onSelectWidget, selectedWidgetTypes = [] }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState('all')

    // Fetch available widget types - now returns direct array instead of paginated results
    const { data: widgetTypes, isLoading, error } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/widget-types/')
            // New API returns direct array, filter active ones
            return response.data?.filter(widget => widget.is_active) || []
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
            // Phase 6: Extended Widget Types
            case 'news':
                return Newspaper
            case 'events':
                return Calendar
            case 'calendar':
                return Calendar
            case 'forms':
                return FileText
            case 'gallery':
                return ImageIcon
            default:
                return Grid3X3
        }
    }

    // Filter and search logic
    const filteredWidgets = widgetTypes?.filter(widget => {
        const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            widget.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesCategory = filterCategory === 'all' ||
            getCategoryForWidget(widget.name) === filterCategory

        return matchesSearch && matchesCategory
    }) || []

    // Get category for widget (for filtering)
    const getCategoryForWidget = (widgetName) => {
        const name = widgetName.toLowerCase()
        if (['text block', 'html block'].includes(name)) return 'content'
        if (['image', 'gallery'].includes(name)) return 'media'
        if (['button', 'forms'].includes(name)) return 'interactive'
        if (['news', 'events', 'calendar'].includes(name)) return 'dynamic'
        if (['spacer'].includes(name)) return 'layout'
        return 'other'
    }

    // Get unique categories for filter
    const categories = ['all', ...new Set(widgetTypes?.map(w => getCategoryForWidget(w.name)) || [])]

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">Loading widget types...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-red-800 font-medium">Error Loading Widget Types</h3>
                <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search widget types..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {categories.map(category => (
                            <option key={category} value={category}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Widget Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredWidgets.map((widgetType) => {
                    const IconComponent = getWidgetIcon(widgetType.name)
                    const isSelected = selectedWidgetTypes.some(selected => selected.name === widgetType.name)

                    return (
                        <button
                            key={widgetType.name}
                            onClick={() => onSelectWidget(widgetType)}
                            disabled={isSelected}
                            className={`
                                p-4 border rounded-lg text-left transition-all
                                ${isSelected
                                    ? 'border-green-300 bg-green-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                }
                            `}
                        >
                            <div className="flex items-start space-x-3">
                                <div className={`
                                    p-2 rounded-lg
                                    ${isSelected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}
                                `}>
                                    <IconComponent className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`
                                        font-medium text-sm
                                        ${isSelected ? 'text-green-800' : 'text-gray-900'}
                                    `}>
                                        {widgetType.name}
                                        {isSelected && (
                                            <span className="ml-2 text-xs text-green-600">(Selected)</span>
                                        )}
                                    </h3>
                                    <p className={`
                                        text-xs mt-1 line-clamp-2
                                        ${isSelected ? 'text-green-600' : 'text-gray-500'}
                                    `}>
                                        {widgetType.description}
                                    </p>
                                    <div className="mt-2">
                                        <span className={`
                                            inline-block px-2 py-1 text-xs rounded-full
                                            ${isSelected
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }
                                        `}>
                                            {getCategoryForWidget(widgetType.name)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {filteredWidgets.length === 0 && (
                <div className="text-center py-8">
                    <Grid3X3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-500 font-medium">No widget types found</h3>
                    <p className="text-gray-400 text-sm mt-1">
                        {searchTerm || filterCategory !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'No widget types are available'
                        }
                    </p>
                </div>
            )}

            {/* Info about code-based widgets */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                    <Code className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-blue-800 text-sm font-medium">Code-Based Widget Types</p>
                        <p className="text-blue-600 text-xs mt-1">
                            Widget types are now defined in code for better maintainability and type safety.
                            Custom widgets can be added by developers through the codebase.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WidgetLibrary 