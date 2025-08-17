import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Plus,
    ChevronDown,
    Type,
    Image,
    MousePointer,
    Space,
    Code,
    Grid3X3,
    Newspaper,
    Calendar,
    Users,
    FileText,
    ImageIcon,
    Loader2
} from 'lucide-react'
import { api } from '../api/client'

/**
 * Compact icon menu for adding widgets to slots
 * Provides a dropdown interface for quick widget selection
 */
const WidgetIconMenu = ({
    onSelectWidget,
    slot = null,
    disabled = false,
    className = '',
    maxWidgetsReached = false
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [hoveredWidget, setHoveredWidget] = useState(null)
    const menuRef = useRef(null)
    const buttonRef = useRef(null)

    // Fetch available widget types
    const { data: widgetTypes, isLoading, error } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/widget-types/')
            return response.data?.filter(widget => widget.isActive) || []
        }
    })

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    // Close menu on Escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen])

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

    // Filter widgets based on slot restrictions
    const getAvailableWidgets = () => {
        if (!widgetTypes) return []

        let available = [...widgetTypes]

        // Filter by allowed widget types if slot specifies them
        if (slot?.allowedWidgetTypes && slot.allowedWidgetTypes.length > 0) {
            available = available.filter(widget =>
                slot.allowedWidgetTypes.includes(widget.name)
            )
        }

        return available
    }

    const handleWidgetSelect = (widget) => {
        onSelectWidget(widget)
        setIsOpen(false)
        setHoveredWidget(null)
    }

    const handleToggleMenu = () => {
        if (!disabled && !maxWidgetsReached) {
            setIsOpen(!isOpen)
        }
    }

    const availableWidgets = getAvailableWidgets()

    return (
        <div className={`relative ${className}`}>
            {/* Icon Button */}
            <button
                ref={buttonRef}
                onClick={handleToggleMenu}
                disabled={disabled || maxWidgetsReached}
                className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all
                    ${disabled || maxWidgetsReached
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isOpen
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                    }
                `}
                title={maxWidgetsReached ? 'Maximum widgets reached' : 'Add widget'}
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Plus className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && !isLoading && !error && (
                <div
                    ref={menuRef}
                    className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
                >
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Add Widget</span>
                            {slot && (
                                <span className="text-xs text-gray-500">
                                    to {slot.display_name || slot.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Widget List */}
                    <div className="py-1">
                        {availableWidgets.length > 0 ? (
                            availableWidgets.map((widget) => {
                                const IconComponent = getWidgetIcon(widget.name)
                                return (
                                    <button
                                        key={widget.name}
                                        onClick={() => handleWidgetSelect(widget)}
                                        onMouseEnter={() => setHoveredWidget(widget.name)}
                                        onMouseLeave={() => setHoveredWidget(null)}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-1.5 rounded bg-gray-100 group-hover:bg-blue-100 transition-colors">
                                                <IconComponent className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                                                    {widget.name}
                                                </div>
                                                <div className="text-xs text-gray-500 group-hover:text-blue-600 truncate">
                                                    {widget.description}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        ) : (
                            <div className="px-3 py-4 text-center">
                                <Grid3X3 className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                                <div className="text-sm text-gray-500">No widgets available</div>
                                {slot?.allowedWidgetTypes && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        This slot only accepts: {slot.allowedWidgetTypes.join(', ')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer with count */}
                    {availableWidgets.length > 0 && (
                        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                            <div className="text-xs text-gray-500">
                                {availableWidgets.length} widget{availableWidgets.length !== 1 ? 's' : ''} available
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error State */}
            {isOpen && error && (
                <div
                    ref={menuRef}
                    className="absolute top-full right-0 mt-1 w-64 bg-white border border-red-200 rounded-lg shadow-lg z-50"
                >
                    <div className="p-3 text-center">
                        <div className="text-sm text-red-600 font-medium">Error loading widgets</div>
                        <div className="text-xs text-red-500 mt-1">{error.message}</div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default WidgetIconMenu 