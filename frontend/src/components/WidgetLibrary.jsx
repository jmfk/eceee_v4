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
import axios from 'axios'
import CustomWidgetCreator from './CustomWidgetCreator'

const WidgetLibrary = ({ onSelectWidget, selectedWidgetTypes = [] }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState('all')
    const [showCustomCreator, setShowCustomCreator] = useState(false)

    // Fetch available widget types
    const { data: widgetTypes, isLoading, error } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await axios.get('/api/v1/webpages/widget-types/')
            return response.data.filter(widget => widget.is_active)
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

        const matchesFilter = filterCategory === 'all' ||
            widget.name.toLowerCase().includes(filterCategory)

        return matchesSearch && matchesFilter
    }) || []

    const categories = [
        { value: 'all', label: 'All Widgets' },
        { value: 'text', label: 'Text' },
        { value: 'image', label: 'Media' },
        { value: 'button', label: 'Interactive' },
        { value: 'spacer', label: 'Layout' },
        { value: 'html', label: 'Advanced' }
    ]

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-red-600">
                    <p>Error loading widget types: {error.message}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Widget Library</h3>
                    <button
                        onClick={() => setShowCustomCreator(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                        title="Create Custom Widget"
                    >
                        <Plus size={16} />
                        Custom
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                        >
                            {categories.map(category => (
                                <option key={category.value} value={category.value}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Widget List */}
            <div className="max-h-96 overflow-y-auto">
                {filteredWidgets.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {filteredWidgets.map((widget) => {
                            const IconComponent = getWidgetIcon(widget.name)
                            const isSelected = selectedWidgetTypes.includes(widget.id)

                            return (
                                <div
                                    key={widget.id}
                                    onClick={() => onSelectWidget && onSelectWidget(widget)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                                        }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            <IconComponent className="w-5 h-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className={`font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'
                                                    }`}>
                                                    {widget.name}
                                                </h4>
                                                {onSelectWidget && (
                                                    <Plus className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                                {widget.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <Grid3X3 className="w-8 h-8 mx-auto mb-2" />
                        <p>No widgets found</p>
                        {searchTerm && (
                            <p className="text-sm mt-1">
                                Try adjusting your search terms or filters
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {filteredWidgets.length > 0 && (
                <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-center">
                    {filteredWidgets.length} widget{filteredWidgets.length !== 1 ? 's' : ''} available
                </div>
            )}

            {/* Custom Widget Creator Modal */}
            {showCustomCreator && (
                <CustomWidgetCreator
                    onClose={() => setShowCustomCreator(false)}
                    onWidgetCreated={(widget) => {
                        setShowCustomCreator(false)
                        // Optionally auto-select the new widget
                        onSelectWidget?.(widget)
                    }}
                />
            )}
        </div>
    )
}

export default WidgetLibrary 