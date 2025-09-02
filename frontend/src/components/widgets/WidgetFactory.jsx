import React, { useState } from 'react'
import { Layout, Settings, Trash2, Eye, ChevronUp, ChevronDown } from 'lucide-react'
import WidgetRenderer from './WidgetRenderer'

/**
 * Widget Factory component that creates widget elements with controls
 * Used by both ContentEditor and ObjectContentEditor
 */

const WidgetFactory = ({
    widget,
    slotName,
    index,
    onEdit,
    onDelete,
    onPreview,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    mode = 'editor',
    showControls = true,
    className = ''
}) => {
    const [isHovered, setIsHovered] = useState(false)

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

    const handlePreview = () => {
        if (onPreview) {
            onPreview(widget)
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

    // Widget wrapper with controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item relative p-4 mb-3 hover:bg-gray-50 hover:shadow-sm transition-colors ${className}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Hover Menu - positioned in top-right corner */}
                {isHovered && (
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white shadow-lg rounded-md p-1 border z-10">
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
                        {onPreview && (
                            <button
                                onClick={handlePreview}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors rounded"
                                title="Preview widget"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={handleEdit}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded"
                                title="Edit widget"
                            >
                                <Settings className="h-4 w-4" />
                            </button>
                        )}
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

                {/* Widget Type Info */}
                {/* <div className="text-xs text-gray-500 mb-2">
                    Type: {widget.type}
                </div> */}

                {/* Widget Content */}
                <WidgetRenderer widget={widget} mode="preview" />

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
            <WidgetRenderer widget={widget} mode={mode} />
        </div>
    )
}

export default WidgetFactory
