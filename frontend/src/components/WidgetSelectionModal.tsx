// WidgetSelectionModal component that replicates the PageEditor widget selection modal
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { getWidgetDisplayName } from '../hooks/useWidgets'
import {
    getCoreWidgetIcon as getWidgetIcon,
    getCoreWidgetCategory as getWidgetCategory,
    getCoreWidgetDescription as getWidgetDescription
} from '../widgets'
const WidgetSelectionModal = ({ isOpen, onClose, onSelectWidget, slot, availableWidgetTypes, isFilteringTypes }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const modalRef = useRef<HTMLDivElement | null>(null)

    // Filter available widget types based on slot configuration and search term
    const filteredWidgets = useMemo(() => {
        if (!slot?.widgetControls || !availableWidgetTypes) return []

        let widgets = slot.widgetControls
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

        // Filter by search term
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
    }, [slot, availableWidgetTypes, searchTerm])

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                                    key={widget.type + index}
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