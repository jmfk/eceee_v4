// WidgetSelectionModal component that replicates the PageEditor widget selection modal
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { getWidgetDisplayName } from '../hooks/useWidgets'
import {
    getWidgetIcon,
    getWidgetCategory,
    getWidgetDescription
} from '../widgets'
const WidgetSelectionModal = ({ isOpen, onClose, onSelectWidget, slot, availableWidgetTypes, isFilteringTypes, context }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [showAllWidgets, setShowAllWidgets] = useState(false) // Override filtering
    const modalRef = useRef<HTMLDivElement | null>(null)

    // Filter available widget types based on slot configuration and search term
    const filteredWidgets = useMemo(() => {
        if (!availableWidgetTypes) return []

        let widgets = []

        // If override is active, show all widgets
        if (showAllWidgets) {
            widgets = availableWidgetTypes.map(wt => ({
                type: wt.type || wt.widgetType,
                name: wt.name || wt.display_name || getWidgetDisplayName(wt.type || wt.widgetType),
                description: getWidgetDescription(wt.type || wt.widgetType) || wt.description || 'No description available',
                category: getWidgetCategory(wt.type || wt.widgetType) || wt.category || 'General',
                icon: getWidgetIcon(wt.type || wt.widgetType) || wt.icon || '🧩'
            }))
        }
        // If widgetControls exist, use them
        else if (slot?.widgetControls && slot.widgetControls.length > 0) {
            widgets = slot.widgetControls
                .filter(control => {
                    // Only show widget controls that are available on the server
                    return availableWidgetTypes.some(available =>
                        available.type === control.widgetType ||
                        available.widgetType === control.widgetType
                    )
                })
                .map(control => {
                    const widgetType = availableWidgetTypes.find(available =>
                        available.type === control.widgetType ||
                        available.widgetType === control.widgetType
                    )
                    return {
                        type: control.widgetType,
                        name: control.label || getWidgetDisplayName(control.widgetType),
                        description: getWidgetDescription(control.widgetType) || widgetType?.description || 'No description available',
                        category: getWidgetCategory(control.widgetType) || widgetType?.category || 'General',
                        icon: getWidgetIcon(control.widgetType) || widgetType?.icon || '🧩'
                    }
                })
        }
        // Check for allowed_types or disallowed_types
        else if (slot?.allowedTypes || slot?.disallowedTypes) {
            const allowedTypes = slot.allowedTypes || []
            const disallowedTypes = slot.disallowedTypes || []

            widgets = availableWidgetTypes
                .filter(wt => {
                    const widgetType = wt.type || wt.widgetType

                    // If allowed_types exists, use it as whitelist
                    if (allowedTypes.length > 0) {
                        return allowedTypes.some(allowedType => {
                            if (allowedType.endsWith('.*')) {
                                const prefix = allowedType.slice(0, -2)
                                return widgetType.startsWith(prefix)
                            }
                            return widgetType === allowedType
                        })
                    }

                    // Otherwise, use disallowed_types as blacklist
                    if (disallowedTypes.length > 0) {
                        return !disallowedTypes.some(disallowedType => {
                            if (disallowedType.endsWith('.*')) {
                                const prefix = disallowedType.slice(0, -2)
                                return widgetType.startsWith(prefix)
                            }
                            return widgetType === disallowedType
                        })
                    }

                    return true
                })
                .map(wt => ({
                    type: wt.type || wt.widgetType,
                    name: wt.name || wt.display_name || getWidgetDisplayName(wt.type || wt.widgetType),
                    description: getWidgetDescription(wt.type || wt.widgetType) || wt.description || 'No description available',
                    category: getWidgetCategory(wt.type || wt.widgetType) || wt.category || 'General',
                    icon: getWidgetIcon(wt.type || wt.widgetType) || wt.icon || '🧩'
                }))
        }
        // Default fallback: show all available widgets
        else {
            widgets = availableWidgetTypes.map(wt => ({
                type: wt.type || wt.widgetType,
                name: wt.name || wt.display_name || getWidgetDisplayName(wt.type || wt.widgetType),
                description: getWidgetDescription(wt.type || wt.widgetType) || wt.description || 'No description available',
                category: getWidgetCategory(wt.type || wt.widgetType) || wt.category || 'General',
                icon: getWidgetIcon(wt.type || wt.widgetType) || wt.icon || '🧩'
            }))
        }

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            widgets = widgets.filter(widget =>
                widget.name.toLowerCase().includes(term) ||
                widget.description.toLowerCase().includes(term) ||
                widget.category.toLowerCase().includes(term) ||
                widget.type.toLowerCase().includes(term)
            )
        }

        return widgets
    }, [slot, availableWidgetTypes, searchTerm, showAllWidgets])

    // Close modal when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && event.target instanceof Node && !modalRef.current.contains(event.target)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    const handleWidgetSelect = (widgetType) => {
        onSelectWidget(widgetType)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
                ref={modalRef}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
            >
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Add Widget to Slot</h3>
                            <p className="text-sm text-gray-600">{slot?.label || slot?.name}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Override checkbox */}
                    {(slot?.widgetControls?.length > 0 || slot?.allowedTypes?.length > 0 || slot?.disallowedTypes?.length > 0) && (
                        <div className="mb-4 flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showAllWidgets}
                                    onChange={(e) => setShowAllWidgets(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Show All Widgets</span>
                                {showAllWidgets && (
                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                                        Override Active
                                    </span>
                                )}
                            </label>
                        </div>
                    )}

                    {/* Widget Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {isFilteringTypes ? (
                            <div className="col-span-full flex items-center justify-center py-12">
                                <div className="text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="mt-2 text-sm text-gray-600">Loading widgets...</p>
                                </div>
                            </div>
                        ) : filteredWidgets.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <div className="text-4xl mb-2">🔍</div>
                                <p className="text-sm">No widgets found</p>
                                {searchTerm && (
                                    <p className="text-xs mt-1">Try adjusting your search terms</p>
                                )}
                            </div>
                        ) : (
                            filteredWidgets.map((widget, index) => (
                                <div
                                    key={`${widget.type}-${index}`}
                                    onClick={() => handleWidgetSelect(widget.type)}
                                    className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className="bg-gray-100 rounded-lg w-12 h-12 flex items-center justify-center text-gray-600">
                                            {widget.icon && typeof widget.icon === 'function' ? (
                                                React.createElement(widget.icon, { className: "h-6 w-6" })
                                            ) : React.isValidElement(widget.icon) ? (
                                                React.cloneElement(widget.icon, { className: "h-6 w-6" })
                                            ) : widget.icon && typeof widget.icon === 'object' ? (
                                                // Handle case where icon is an object (like a React component)
                                                React.createElement(widget.icon, { className: "h-6 w-6" })
                                            ) : (
                                                <span className="text-xl font-bold">{typeof widget.icon === 'string' ? widget.icon : '🧩'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">{widget.name}</h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">{widget.description}</p>
                                            <div className="mt-2">
                                                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                    {widget.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WidgetSelectionModal