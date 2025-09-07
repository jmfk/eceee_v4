import React from 'react'
import { Settings, Trash2, ChevronUp, ChevronDown, Eye } from 'lucide-react'

/**
 * Light header component for widgets - matches ContentWidget toolbar styling
 * Shows widget type on left and edit buttons as small icons on right
 */
const WidgetHeader = ({
    widgetType,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onPreview,
    canMoveUp = false,
    canMoveDown = false,
    showControls = true
}) => {
    return (
        <div className="widget-header bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between text-xs">
            {/* Widget Type Label */}
            <div className="flex items-center">
                <span className="font-medium text-gray-700">
                    {widgetType}
                </span>
            </div>

            {/* Edit Controls */}
            {showControls && (
                <div className="flex items-center space-x-1">
                    {/* Preview Button */}
                    {onPreview && (
                        <button
                            onClick={onPreview}
                            className="p-0.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors rounded"
                            title="Preview widget"
                        >
                            <Eye className="h-3 w-3" />
                        </button>
                    )}

                    {/* Move Up Button */}
                    {onMoveUp && (
                        <button
                            onClick={onMoveUp}
                            disabled={!canMoveUp}
                            className={`p-0.5 transition-colors rounded ${canMoveUp
                                    ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                            title={canMoveUp ? "Move widget up" : "Cannot move up"}
                        >
                            <ChevronUp className="h-3 w-3" />
                        </button>
                    )}

                    {/* Move Down Button */}
                    {onMoveDown && (
                        <button
                            onClick={onMoveDown}
                            disabled={!canMoveDown}
                            className={`p-0.5 transition-colors rounded ${canMoveDown
                                    ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                            title={canMoveDown ? "Move widget down" : "Cannot move down"}
                        >
                            <ChevronDown className="h-3 w-3" />
                        </button>
                    )}

                    {/* Edit Button */}
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="p-0.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors rounded"
                            title="Edit widget"
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                    )}

                    {/* Delete Button */}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="p-0.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors rounded"
                            title="Delete widget"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default WidgetHeader