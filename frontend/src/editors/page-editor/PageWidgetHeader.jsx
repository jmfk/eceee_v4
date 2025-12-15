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
    ExternalLink,
    Clipboard,
    ClipboardPaste,
    Scissors
} from 'lucide-react'
import ConfirmationModal from '../../components/ConfirmationModal'
import { copyWidgetsToClipboard, cutWidgetsToClipboard, readClipboardWithMetadata } from '../../utils/clipboardService'
import { generateNewWidgetIds } from '../../utils/widgetClipboard'
import { useClipboard } from '../../contexts/ClipboardContext'

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
    inheritedFrom = null,
    // Copy/Paste props
    widget = null,
    onPaste = null,
    // Cut props
    onCut = null,
    pageId = null,
    widgetPath = null,
    // Selection props
    slotName = null,
    isSelected = false,
    isCut = false,
    onToggleSelection = null,
    // Active/Inactive toggle props
    onConfigChange = null
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isActive, setIsActive] = useState(widget?.config?.isActive !== false);
    const { refreshClipboard } = useClipboard();

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

    const handleCopy = async () => {
        if (widget) {
            await copyWidgetsToClipboard([widget]);
            await refreshClipboard();
        }
    };

    const handleCut = async () => {
        if (!widget || !slotName) return;
        
        // Build metadata for cut operation
        const cutMetadata = {
            pageId: pageId,
            widgetPaths: widgetPath ? [widgetPath] : [`${slotName}/${widget.id}`],
            widgets: {
                [slotName]: [widget.id]
            }
        };
        
        await cutWidgetsToClipboard([widget], cutMetadata);
        await refreshClipboard();
        
        // If onCut callback is provided, call it (for visual feedback)
        if (onCut) {
            onCut();
        }
    };

    const handlePaste = async () => {
        if (!onPaste) {
            return;
        }
        
        const clipboardResult = await readClipboardWithMetadata();
        
        if (clipboardResult && clipboardResult.data && clipboardResult.data.length > 0) {
            const pastedWidget = clipboardResult.data[0];
            const widgetWithNewId = generateNewWidgetIds(pastedWidget);
            
            // Pass clipboard metadata if it's a cut operation
            const metadata = clipboardResult.operation === 'cut' ? {
                operation: clipboardResult.operation,
                metadata: clipboardResult.metadata
            } : undefined;
            
            onPaste(widgetWithNewId, metadata);
        }
    };

    const handleToggleActive = () => {
        if (!widget || !onConfigChange) return;
        
        const newActiveState = !isActive;
        setIsActive(newActiveState);
        
        // Update widget config through parent
        const updatedConfig = {
            ...widget.config,
            isActive: newActiveState
        };
        
        onConfigChange(updatedConfig);
    };

    return (
        <div className={`widget-header page-editor-header px-3 py-2 flex items-center justify-between ${isInherited ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-100 border border-gray-200'} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isCut ? 'opacity-60' : ''} ${className}`}>
            {/* Left side - Widget info and status */}
            <div className="flex items-center space-x-2">
                {/* Selection checkbox */}
                {onToggleSelection && !isInherited && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelection}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        title={isSelected ? 'Deselect widget' : 'Select widget'}
                    />
                )}

                {/* Inherited indicator */}
                {isInherited && (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                )}

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${isInherited ? 'text-amber-800' : 'text-gray-700'} ${isCut ? 'line-through' : ''}`}>
                        {widgetType}
                        {widget?.config?.anchor && (
                            <span className="text-gray-500"> → #{widget.config.anchor}</span>
                        )}
                    </span>

                    {/* Active/Inactive toggle button */}
                    {!isInherited && widget && (
                        <button
                            onClick={handleToggleActive}
                            className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title={isActive ? 'Click to deactivate widget' : 'Click to activate widget'}
                        >
                            {isActive ? 'Active' : 'Inactive'}
                        </button>
                    )}

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

                    {/* Copy/Cut/Paste controls */}
                    {(widget || onPaste || onCut) && (
                        <div className="flex items-center border-r border-gray-300 pr-2 mr-2">
                            {widget && (
                                <>
                                    <button
                                        onClick={handleCopy}
                                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                        title="Copy widget"
                                    >
                                        <Clipboard className="h-3 w-3" />
                                    </button>
                                    {(onCut || (widget && slotName)) && (
                                        <button
                                            onClick={handleCut}
                                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                            title="Cut widget"
                                        >
                                            <Scissors className="h-3 w-3" />
                                        </button>
                                    )}
                                </>
                            )}
                            {onPaste && (
                                <button
                                    onClick={handlePaste}
                                    className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                    title="Paste widget after this one"
                                >
                                    <ClipboardPaste className="h-3 w-3" />
                                </button>
                            )}
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
