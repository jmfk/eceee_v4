import React, { useState } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react'
import WidgetRenderer from './WidgetRenderer'
import { WIDGET_REGISTRY } from './widgetRegistry'

/**
 * Widget Factory component that creates widget elements with controls
 * Used by both ContentEditor and ObjectContentEditor
 */

/**
 * Get widget type display name from widget instance
 * @param {Object} widget - Widget instance
 * @returns {string} Widget type display name
 */
const getWidgetTypeName = (widget) => {
    if (!widget || !widget.type) {
        return 'Widget';
    }

    const registryEntry = WIDGET_REGISTRY[widget.type];
    if (registryEntry && registryEntry.metadata && registryEntry.metadata.name) {
        return registryEntry.metadata.name;
    }

    // Fallback to extracting name from type string
    const typeParts = widget.type.split('.');
    return typeParts[typeParts.length - 1].replace('Widget', '');
};

const WidgetFactory = ({
    widget,
    slotName,
    index,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onConfigChange,
    canMoveUp = false,
    canMoveDown = false,
    mode = 'editor',
    showControls = true,
    className = ''
}) => {
    const [isHovered, setIsHovered] = useState(false)
    const [isMenuExpanded, setIsMenuExpanded] = useState(true)
    const [showPreview, setShowPreview] = useState(false)

    const handleEdit = () => {
        if (onEdit) {
            onEdit(slotName, index, widget)
        }
    }

    const handleDelete = () => {
        if (onDelete) {
            onDelete(slotName, index, widget)
        }
    }



    const handleMoveUp = () => {
        if (onMoveUp && canMoveUp) {
            onMoveUp(slotName, index, widget)
        }
    }

    const handleMoveDown = () => {
        if (onMoveDown && canMoveDown) {
            onMoveDown(slotName, index, widget)
        }
    }

    const handlePreview = () => {
        setShowPreview(true)
    }

    const handleClosePreview = () => {
        setShowPreview(false)
    }

    const toggleMenuExpansion = () => {
        setIsMenuExpanded(!isMenuExpanded)
    }

    // Widget wrapper with controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item relative hover:shadow-sm transition-colors ${className}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Enhanced Hover Menu - positioned in top-right corner */}
                {isHovered && (
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white shadow-lg rounded-md p-1 border z-10">
                        {/* Expand/Contract Button */}
                        <button
                            onClick={toggleMenuExpansion}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded"
                            title={isMenuExpanded ? "Minimize menu" : "Expand menu"}
                        >
                            {isMenuExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>

                        {/* Widget Type Label */}
                        <span
                            className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded"
                            title={`Widget Type: ${getWidgetTypeName(widget)}`}
                        >
                            {isMenuExpanded ? getWidgetTypeName(widget) : getWidgetTypeName(widget).charAt(0)}
                        </span>

                        {/* Menu Container (can be hidden/shown) */}
                        {isMenuExpanded && (
                            <div className="flex items-center space-x-1">
                                {/* Preview Button */}
                                <button
                                    onClick={handlePreview}
                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors rounded"
                                    title="Preview widget"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>

                                {/* Move Up Button */}
                                {onMoveUp && (
                                    <button
                                        onClick={handleMoveUp}
                                        disabled={!canMoveUp}
                                        className={`p-1.5 transition-colors rounded ${canMoveUp
                                            ? 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                            : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                        title={canMoveUp ? "Move widget up" : "Cannot move up"}
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Move Down Button */}
                                {onMoveDown && (
                                    <button
                                        onClick={handleMoveDown}
                                        disabled={!canMoveDown}
                                        className={`p-1.5 transition-colors rounded ${canMoveDown
                                            ? 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                            : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                        title={canMoveDown ? "Move widget down" : "Cannot move down"}
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Edit Button */}
                                {onEdit && (
                                    <button
                                        onClick={handleEdit}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded"
                                        title="Edit widget"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Delete Button */}
                                {onDelete && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded"
                                        title="Delete widget"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}



                {/* Widget Content */}
                <WidgetRenderer
                    widget={widget}
                    mode={mode}
                    onConfigChange={onConfigChange}
                />

                {/* Preview Modal */}
                {showPreview && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        onClick={handleClosePreview}
                    >
                        <div
                            className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-auto m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Preview: {getWidgetTypeName(widget)}
                                </h3>
                                <button
                                    onClick={handleClosePreview}
                                    className="text-gray-400 hover:text-gray-600 w-6 h-6"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="">
                                <WidgetRenderer widget={widget} mode="preview" />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        )
    }

    // Simple widget renderer without controls
    return (
        <div
            className={`widget-item ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
        >
            <WidgetRenderer
                widget={widget}
                mode={mode}
                onConfigChange={onConfigChange}
            />
        </div>
    )
}

export default WidgetFactory
