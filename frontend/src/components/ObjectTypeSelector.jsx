import React, { useState } from 'react'
import { Plus, ChevronDown, Layout } from 'lucide-react'

const ObjectTypeSelector = ({
    allowedChildTypes = [],
    onSelect,
    disabled = false,
    placeholder = "Add sub-object",
    parentId = null
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const handleSelect = (childType) => {
        onSelect(childType, parentId)
        setIsOpen(false)
    }

    if (allowedChildTypes.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Layout className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">
                    No child object types configured
                </p>
                <p className="text-gray-500 text-xs mt-1">
                    Configure allowed child types in the object type settings
                </p>
            </div>
        )
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
                <Plus className="w-4 h-4 mr-2" />
                {placeholder}
                <ChevronDown className={`w-4 h-4 ml-2 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2">
                            Choose object type to create
                        </div>
                        <div className="space-y-1">
                            {allowedChildTypes.map((childType) => (
                                <button
                                    key={childType.id}
                                    type="button"
                                    onClick={() => handleSelect(childType)}
                                    className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-md transition-colors group"
                                >
                                    <div className="flex items-center space-x-3 flex-1">
                                        {childType.iconImage ? (
                                            <img
                                                src={childType.iconImage}
                                                alt={childType.label}
                                                className="w-8 h-8 object-cover rounded"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                                <span className="text-blue-600 font-medium text-sm">
                                                    {childType.label?.charAt(0) || 'O'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {childType.label}
                                            </h4>
                                            <p className="text-sm text-gray-500 truncate">
                                                {childType.description || `Create a new ${childType.label.toLowerCase()}`}
                                            </p>
                                        </div>
                                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    )
}

export default ObjectTypeSelector
