/**
 * PageWidgetHeaderWithSlots
 * 
 * Enhanced widget header for widgets that contain slots.
 * Combines standard widget controls with slot controls (Add Widget, Clear Slot).
 */
import React, { useState } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    Lock,
    ExternalLink,
    Plus,
    Clipboard,
    ClipboardPaste,
    Scissors
} from 'lucide-react'
import ConfirmationModal from '../../components/ConfirmationModal'
import PasteConfirmationModal from '../../components/PasteConfirmationModal'
import { copyWidgetsToClipboard, cutWidgetsToClipboard, readClipboardWithMetadata } from '../../utils/clipboardService'
import { generateNewWidgetIds } from '../../utils/widgetClipboard'

const PageWidgetHeaderWithSlots = ({
    widgetType,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    showControls = true,
    className = '',
    // Inheritance props
    isInherited = false,
    inheritedFrom = null,
    // Slot controls props
    slotLabel = null, // Custom slot label (can be JSX)
    showAddButton = true,
    showClearButton = false,
    onAddWidget = null,
    onClearSlot = null,
    canAddWidget = true,
    widgetCount = 0,
    maxWidgets = null,
    // Copy/Paste props for widget-level
    widget = null,
    onPaste = null,
    // Cut props
    onCut = null,
    pageId = null,
    widgetPath = null,
    // Copy/Paste props for slot-level
    widgets = null,
    onPasteToSlot = null,
    // Selection props
    slotName = null,
    isSelected = false,
    isCut = false,
    onToggleSelection = null
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showPasteConfirm, setShowPasteConfirm] = useState(false)
    const [pendingPasteWidgets, setPendingPasteWidgets] = useState(null)

    if (!showControls) {
        return null
    }

    const handleNavigateToParent = () => {
        if (inheritedFrom && inheritedFrom.id) {
            window.open(`/pages/${inheritedFrom.id}/edit/content`, '_blank')
        }
    }

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true)
    }

    const handleConfirmDelete = () => {
        if (onDelete) {
            onDelete()
        }
    }

    // Widget-level copy/paste handlers
    const handleCopyWidget = async () => {
        if (widget) {
            await copyWidgetsToClipboard([widget])
        }
    }

    const handleCutWidget = async () => {
        if (!widget || !slotName) return
        
        // Build metadata for cut operation
        const cutMetadata = {
            pageId: pageId,
            widgetPaths: widgetPath ? [widgetPath] : [`${slotName}/${widget.id}`],
            widgets: {
                [slotName]: [widget.id]
            }
        }
        
        await cutWidgetsToClipboard([widget], cutMetadata)
        
        // If onCut callback is provided, call it (for visual feedback)
        if (onCut) {
            onCut()
        }
    }

    const handlePasteWidget = async () => {
        if (!onPaste) return
        
        const clipboardResult = await readClipboardWithMetadata()
        if (clipboardResult && clipboardResult.data && clipboardResult.data.length > 0) {
            const widgetWithNewId = generateNewWidgetIds(clipboardResult.data[0])
            
            // Pass clipboard metadata if it's a cut operation
            const metadata = clipboardResult.operation === 'cut' ? {
                operation: clipboardResult.operation,
                metadata: clipboardResult.metadata
            } : undefined;
            
            onPaste(widgetWithNewId, metadata)
        }
    }

    // Slot-level copy/paste handlers
    const handleCopyAllWidgets = async () => {
        if (widgets && Array.isArray(widgets)) {
            await copyWidgetsToClipboard(widgets)
        }
    }

    const handlePasteToSlot = async () => {
        if (!onPasteToSlot) return
        
        const clipboardResult = await readClipboardWithMetadata()
        if (clipboardResult && clipboardResult.data && clipboardResult.data.length > 0) {
            setPendingPasteWidgets({
                widgets: clipboardResult.data,
                operation: clipboardResult.operation,
                metadata: clipboardResult.metadata
            })
            setShowPasteConfirm(true)
        }
    }

    const handleConfirmPaste = (mode) => {
        if (pendingPasteWidgets && onPasteToSlot) {
            const widgetsData = pendingPasteWidgets.widgets || pendingPasteWidgets
            const widgetsArray = Array.isArray(widgetsData) ? widgetsData : [widgetsData]
            const widgetsWithNewIds = widgetsArray.map(w => generateNewWidgetIds(w))
            
            // Pass metadata if it's a cut operation
            const metadata = pendingPasteWidgets.operation === 'cut' ? {
                operation: pendingPasteWidgets.operation,
                metadata: pendingPasteWidgets.metadata
            } : undefined;
            
            onPasteToSlot(widgetsWithNewIds, mode, metadata)
            setPendingPasteWidgets(null)
        }
    }

    const canAdd = canAddWidget && (!maxWidgets || widgetCount < maxWidgets)

    return (
        <div className={`widget-header page-editor-header px-3 py-2 flex items-center justify-between ${isInherited ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-100 border border-gray-200'} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isCut ? 'opacity-60' : ''} ${className}`}>
            {/* Left side - Widget info and slot label */}
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

                {isInherited && (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                )}

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${isInherited ? 'text-amber-800' : 'text-gray-700'} ${isCut ? 'line-through' : ''}`}>
                        {widgetType}
                    </span>

                    {/* Slot label or custom content */}
                    {slotLabel && (
                        <>
                            <span className="text-gray-400">•</span>
                            {typeof slotLabel === 'string' ? (
                                <span className="text-xs text-gray-600">{slotLabel}</span>
                            ) : (
                                slotLabel
                            )}
                        </>
                    )}

                    {/* Widget count indicator */}
                    {maxWidgets && (
                        <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                                {widgetCount}/{maxWidgets}
                            </span>
                        </>
                    )}

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
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => {
                            alert(`Replace inherited ${widgetType} from ${inheritedFrom?.title || 'parent page'}\n\nReplace functionality coming soon.`)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded"
                        title="Replace this inherited widget with a local one"
                    >
                        Replace
                    </button>
                </div>
            ) : (
                <div className="flex items-center space-x-1">
                    {/* Slot controls */}
                    {(showAddButton || showClearButton || widgets || onPasteToSlot) && (
                        <div className="flex items-center border-r border-gray-300 pr-2 mr-2 space-x-1">
                            {showAddButton && onAddWidget && (
                                <button
                                    onClick={onAddWidget}
                                    disabled={!canAdd}
                                    className={`p-1.5 rounded transition-colors ${canAdd
                                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                        : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                    title="Add Widget"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {widgets && Array.isArray(widgets) && widgets.length > 0 && (
                                <button
                                    onClick={handleCopyAllWidgets}
                                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                    title="Copy all widgets"
                                >
                                    <Clipboard className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {onPasteToSlot && (
                                <button
                                    onClick={handlePasteToSlot}
                                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                    title="Paste widgets to slot"
                                >
                                    <ClipboardPaste className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {showClearButton && onClearSlot && widgetCount > 0 && (
                                <button
                                    onClick={onClearSlot}
                                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Clear Slot"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}

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

                    {/* Copy/Cut/Paste controls for widget */}
                    {(widget || onPaste || onCut) && (
                        <div className="flex items-center border-r border-gray-300 pr-2 mr-2">
                            {widget && (
                                <>
                                    <button
                                        onClick={handleCopyWidget}
                                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                        title="Copy widget"
                                    >
                                        <Clipboard className="h-3 w-3" />
                                    </button>
                                    {(onCut || (widget && slotName)) && (
                                        <button
                                            onClick={handleCutWidget}
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
                                    onClick={handlePasteWidget}
                                    className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                    title="Paste widget after this one"
                                >
                                    <ClipboardPaste className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Widget controls */}
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

            <PasteConfirmationModal
                isOpen={showPasteConfirm}
                onClose={() => {
                    setShowPasteConfirm(false)
                    setPendingPasteWidgets(null)
                }}
                onConfirm={handleConfirmPaste}
                widgetCount={pendingPasteWidgets?.length || 0}
                mode="slot"
            />
        </div>
    )
}

export default PageWidgetHeaderWithSlots

