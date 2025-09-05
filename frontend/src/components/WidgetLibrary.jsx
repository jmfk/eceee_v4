import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Search,
    Plus,
    Grid3X3,
    Filter,
    Code
} from 'lucide-react'
import { widgetsApi } from '../api'
import { getAvailableWidgetTypes } from '../utils/widgetTypeValidation'
import {
    getWidgetIcon,
    getWidgetCategory,
    getWidgetDescription,
    searchWidgets,
    filterWidgetsByCategory,
    getAvailableCategories
} from './widgets/widgetRegistry'

const WidgetLibrary = ({ onSelectWidget, selectedWidgetTypes = [] }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState('all')
    const [availableWidgetTypes, setAvailableWidgetTypes] = useState([])
    const [isLoadingAvailable, setIsLoadingAvailable] = useState(false)

    // Fetch available widget types from server (validated)
    useEffect(() => {
        const fetchAvailableTypes = async () => {
            setIsLoadingAvailable(true)
            try {
                const types = await getAvailableWidgetTypes()
                // Filter active ones and ensure they have required properties
                const activeTypes = types.filter(widget =>
                    widget.isActive !== false && // Include if isActive is undefined or true
                    widget.name &&
                    widget.type
                )
                setAvailableWidgetTypes(activeTypes)
            } catch (error) {
                console.error('Error fetching available widget types:', error)
                setAvailableWidgetTypes([])
            } finally {
                setIsLoadingAvailable(false)
            }
        }

        fetchAvailableTypes()
    }, [])

    // Use the validated available widget types
    const widgetTypes = availableWidgetTypes
    const isLoading = isLoadingAvailable
    const error = null // Handle errors inline above

    // Widget type icons mapping (now uses registry)
    const getWidgetIconComponent = (widget) => {
        // Try to get icon from registry first
        const IconComponent = getWidgetIcon(widget.type)
        if (IconComponent) {
            return IconComponent
        }

        // Fallback for widgets not in registry
        return Grid3X3
    }

    // Filter and search logic
    const filteredWidgets = widgetTypes?.filter(widget => {
        const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            widget.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesCategory = filterCategory === 'all' ||
            getWidgetCategory(widget.type) === filterCategory

        return matchesSearch && matchesCategory
    }) || []

    // Get unique categories for filter (now uses registry)
    const categories = ['all', ...getAvailableCategories()]

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
                    const IconComponent = getWidgetIconComponent(widgetType)
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
                                            {getWidgetCategory(widgetType.type) || 'other'}
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
                            : availableWidgetTypes.length === 0
                                ? 'No widget types are available on the server'
                                : 'No widget types match your criteria'
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