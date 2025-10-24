/**
 * PageEditor Widget Header
 * 
 * Widget header component specifically designed for PageEditor with
 * version management, publishing controls, layout-specific features, and inheritance support.
 */
import React, { useState } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    Lock,
    ExternalLink
} from 'lucide-react'
import ConfirmationModal from '../../components/ConfirmationModal'

const PageWidgetHeader = ({
    widgetType,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    showControls = true,
    className = '',
    // NEW: Inheritance props
    isInherited = false,
    inheritedFrom = null
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!showControls) {
        return null
    }

    // Handle navigation to parent page
    const handleNavigateToParent = () => {
        if (inheritedFrom && inheritedFrom.id) {
            window.open(`/pages/${inheritedFrom.id}/edit/content`, '_blank')
        }
    }

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = () => {
        if (onDelete) {
            onDelete();
        }
    };

    return (
        <div className={`widget-header page-editor-header px-3 py-2 flex items-center justify-between ${isInherited ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-100 border border-gray-200'} ${className}`}>
            {/* Left side - Widget info and status */}
            <div className="flex items-center space-x-2">
                {/* Inherited indicator */}
                {isInherited && (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                )}

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${isInherited ? 'text-amber-800' : 'text-gray-700'}`}>
                        {widgetType}
                    </span>

                    {/* Inherited badge */}
                    {isInherited && inheritedFrom && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 border border-amber-300">
                            <span>from</span>
                            <button
                                onClick={handleNavigateToParent}
                                className="font-semibold hover:underline inline-flex items-center gap-0.5"
                                title="Open parent page"
                            >
                                {inheritedFrom.title}
                                <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                        </span>
                    )}
                </div>
            </div>

            {/* Right side - Action buttons */}
            {isInherited ? (
                /* Replace button for inherited widgets - only visible on hover */
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => {
                            // TODO: Implement replace functionality
                            alert(`Replace inherited ${widgetType} from ${inheritedFrom?.title || 'parent page'}\n\nReplace functionality coming soon.`);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded"
                        title="Replace this inherited widget with a local one"
                    >
                        Replace
                    </button>
                </div>
            ) : (
                /* Normal controls for local widgets */
                <div className="flex items-center space-x-1">
                    {/* Move controls */}
                    {(canMoveUp || canMoveDown) && (
                        <div className="flex items-center border-r border-gray-300 pr-2 mr-2">
                            <button
                                onClick={onMoveUp}
                                disabled={!canMoveUp}
                                className={`p-1 rounded transition-colors ${canMoveUp
                                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                title="Move up"
                            >
                                <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                                onClick={onMoveDown}
                                disabled={!canMoveDown}
                                className={`p-1 rounded transition-colors ${canMoveDown
                                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                title="Move down"
                            >
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    {/* Quick actions */}
                    <div className="flex items-center space-x-1">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                title="Edit widget"
                            >
                                <Settings className="h-3 w-3" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={handleDeleteClick}
                                className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                                title="Delete widget"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Widget"
                message={`Are you sure you want to delete this ${widgetType} widget? This action cannot be undone.`}
                confirmText="Delete Widget"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    )
}

export default PageWidgetHeader
