import React from 'react'
import { Layout, Settings, Trash2, Eye } from 'lucide-react'
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
    mode = 'editor',
    showControls = true,
    className = ''
}) => {

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

    // Widget wrapper with controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm hover:border-gray-300 transition-colors ${className}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
            >
                {/* Widget Controls Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                        <Layout className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-700">
                            {widget.name || widget.type || 'Widget'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        {onPreview && (
                            <button
                                onClick={handlePreview}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="Preview widget"
                            >
                                <Eye className="h-3 w-3" />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={handleEdit}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit widget"
                            >
                                <Settings className="h-3 w-3" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={handleDelete}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete widget"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Widget Type Info */}
                <div className="text-xs text-gray-500 mb-2">
                    Type: {widget.type}
                </div>

                {/* Widget Content */}
                <div className="widget-content bg-gray-50 p-2 rounded border">
                    <WidgetRenderer widget={widget} mode="preview" />
                </div>
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
