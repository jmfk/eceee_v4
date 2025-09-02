/**
 * WidgetToolbar - Widget action toolbar
 * 
 * Provides common widget actions like edit, duplicate, delete, copy, paste
 * with context-aware functionality for both page and object editing.
 */

import React, { useCallback, useMemo } from 'react'
import {
    Settings,
    Copy,
    Scissors,
    ClipboardPaste,
    Trash2,
    Move,
    Eye,
    EyeOff,
    MoreHorizontal,
    ArrowUp,
    ArrowDown,
    RotateCcw
} from 'lucide-react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext, useClipboard } from '../context/EditorContext'
import { cloneWidget } from '../utils/widgetFactory'

/**
 * WidgetToolbar Component
 */
export function WidgetToolbar({
    widget,
    slotName,
    widgetIndex,
    slotConfig = {},
    onEdit,
    onPreview,
    className = '',
    compact = false,
    position = 'top' // 'top', 'bottom', 'overlay'
}) {
    const {
        context,
        deleteWidget,
        addWidget,
        reorderWidgets,
        getSlotWidgets
    } = useWidgetContext()

    const {
        preferences,
        startDrag
    } = useEditorContext()

    const {
        clipboard,
        copyWidget,
        cutWidget,
        pasteWidget,
        canPasteToSlot
    } = useClipboard()

    const slotWidgets = getSlotWidgets(slotName)
    const isFirstWidget = widgetIndex === 0
    const isLastWidget = widgetIndex === slotWidgets.length - 1

    /**
     * Handle edit widget
     */
    const handleEdit = useCallback(() => {
        if (onEdit) {
            onEdit(widget, slotName, widgetIndex)
        }
    }, [onEdit, widget, slotName, widgetIndex])

    /**
     * Handle duplicate widget
     */
    const handleDuplicate = useCallback(async () => {
        try {
            const duplicatedWidget = cloneWidget(widget)
            const result = await addWidget(slotName, duplicatedWidget, slotConfig)

            if (!result.success) {
                console.error('Failed to duplicate widget:', result.error)
            }
        } catch (error) {
            console.error('Error duplicating widget:', error)
        }
    }, [widget, addWidget, slotName, slotConfig])

    /**
     * Handle delete widget
     */
    const handleDelete = useCallback(async () => {
        const shouldConfirm = preferences.confirmDelete

        if (shouldConfirm) {
            const confirmed = window.confirm('Are you sure you want to delete this widget?')
            if (!confirmed) return
        }

        try {
            const result = await deleteWidget(slotName, widget.id, slotConfig)

            if (!result.success) {
                console.error('Failed to delete widget:', result.error)
            }
        } catch (error) {
            console.error('Error deleting widget:', error)
        }
    }, [deleteWidget, slotName, widget.id, slotConfig, preferences.confirmDelete])

    /**
     * Handle copy widget
     */
    const handleCopy = useCallback(() => {
        copyWidget(widget)
    }, [copyWidget, widget])

    /**
     * Handle cut widget
     */
    const handleCut = useCallback(() => {
        cutWidget(widget)
    }, [cutWidget, widget])

    /**
     * Handle paste widget
     */
    const handlePaste = useCallback(async () => {
        if (!canPasteToSlot(slotName, slotConfig)) return

        try {
            const result = await pasteWidget(slotName, slotConfig)

            if (!result.success) {
                console.error('Failed to paste widget:', result.error)
            }
        } catch (error) {
            console.error('Error pasting widget:', error)
        }
    }, [pasteWidget, slotName, slotConfig, canPasteToSlot])

    /**
     * Handle move widget up
     */
    const handleMoveUp = useCallback(() => {
        if (isFirstWidget) return
        reorderWidgets(slotName, widgetIndex, widgetIndex - 1)
    }, [reorderWidgets, slotName, widgetIndex, isFirstWidget])

    /**
     * Handle move widget down
     */
    const handleMoveDown = useCallback(() => {
        if (isLastWidget) return
        reorderWidgets(slotName, widgetIndex, widgetIndex + 1)
    }, [reorderWidgets, slotName, widgetIndex, isLastWidget])

    /**
     * Handle drag start
     */
    const handleDragStart = useCallback((e) => {
        e.stopPropagation()
        startDrag(widget, slotName, widgetIndex)
    }, [startDrag, widget, slotName, widgetIndex])

    /**
     * Handle preview toggle
     */
    const handlePreview = useCallback(() => {
        if (onPreview) {
            onPreview(widget, slotName, widgetIndex)
        }
    }, [onPreview, widget, slotName, widgetIndex])

    // Check if paste is available
    const canPaste = clipboard.widget && canPasteToSlot(slotName, slotConfig)

    // Toolbar actions configuration
    const actions = useMemo(() => {
        const baseActions = [
            {
                id: 'edit',
                label: 'Edit',
                icon: Settings,
                onClick: handleEdit,
                primary: true
            },
            {
                id: 'copy',
                label: 'Copy',
                icon: Copy,
                onClick: handleCopy
            },
            {
                id: 'cut',
                label: 'Cut',
                icon: Scissors,
                onClick: handleCut
            },
            {
                id: 'duplicate',
                label: 'Duplicate',
                icon: RotateCcw,
                onClick: handleDuplicate,
                disabled: slotConfig.maxWidgets && slotWidgets.length >= slotConfig.maxWidgets
            },
            {
                id: 'delete',
                label: 'Delete',
                icon: Trash2,
                onClick: handleDelete,
                destructive: true
            }
        ]

        // Add paste action if available
        if (canPaste) {
            baseActions.splice(3, 0, {
                id: 'paste',
                label: 'Paste',
                icon: ClipboardPaste,
                onClick: handlePaste
            })
        }

        // Add move actions if multiple widgets
        if (slotWidgets.length > 1) {
            const moveActions = [
                {
                    id: 'move-up',
                    label: 'Move Up',
                    icon: ArrowUp,
                    onClick: handleMoveUp,
                    disabled: isFirstWidget
                },
                {
                    id: 'move-down',
                    label: 'Move Down',
                    icon: ArrowDown,
                    onClick: handleMoveDown,
                    disabled: isLastWidget
                }
            ]

            baseActions.splice(-1, 0, ...moveActions)
        }

        // Add preview action if handler provided
        if (onPreview) {
            baseActions.splice(1, 0, {
                id: 'preview',
                label: 'Preview',
                icon: Eye,
                onClick: handlePreview
            })
        }

        return baseActions
    }, [
        handleEdit,
        handleCopy,
        handleCut,
        handleDuplicate,
        handleDelete,
        handlePaste,
        handleMoveUp,
        handleMoveDown,
        handlePreview,
        canPaste,
        slotWidgets.length,
        isFirstWidget,
        isLastWidget,
        slotConfig.maxWidgets,
        onPreview
    ])

    if (compact) {
        return (
            <CompactToolbar
                actions={actions}
                position={position}
                className={className}
                onDragStart={handleDragStart}
            />
        )
    }

    return (
        <StandardToolbar
            actions={actions}
            position={position}
            className={className}
            onDragStart={handleDragStart}
        />
    )
}

/**
 * Standard Toolbar Component
 */
function StandardToolbar({ actions, position, className, onDragStart }) {
    const positionClasses = {
        top: 'mb-2',
        bottom: 'mt-2',
        overlay: 'absolute top-2 right-2 bg-white shadow-lg rounded-lg'
    }

    return (
        <div className={`flex items-center space-x-1 ${positionClasses[position]} ${className}`}>
            {/* Drag Handle */}
            <button
                onMouseDown={onDragStart}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-move transition-colors"
                title="Drag to move"
            >
                <Move className="h-3 w-3" />
            </button>

            {/* Action Buttons */}
            {actions.map(action => (
                <ToolbarButton key={action.id} action={action} />
            ))}
        </div>
    )
}

/**
 * Compact Toolbar Component
 */
function CompactToolbar({ actions, position, className, onDragStart }) {
    const [showMore, setShowMore] = React.useState(false)

    const primaryActions = actions.filter(action => action.primary)
    const secondaryActions = actions.filter(action => !action.primary)

    const positionClasses = {
        top: 'mb-2',
        bottom: 'mt-2',
        overlay: 'absolute top-2 right-2 bg-white shadow-lg rounded-lg'
    }

    return (
        <div className={`flex items-center space-x-1 ${positionClasses[position]} ${className}`}>
            {/* Drag Handle */}
            <button
                onMouseDown={onDragStart}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-move transition-colors"
                title="Drag to move"
            >
                <Move className="h-3 w-3" />
            </button>

            {/* Primary Actions */}
            {primaryActions.map(action => (
                <ToolbarButton key={action.id} action={action} />
            ))}

            {/* More Actions Dropdown */}
            {secondaryActions.length > 0 && (
                <div className="relative">
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="More actions"
                    >
                        <MoreHorizontal className="h-3 w-3" />
                    </button>

                    {showMore && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowMore(false)}
                            />
                            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                                {secondaryActions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            action.onClick()
                                            setShowMore(false)
                                        }}
                                        disabled={action.disabled}
                                        className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm transition-colors ${action.disabled
                                                ? 'text-gray-400 cursor-not-allowed'
                                                : action.destructive
                                                    ? 'text-red-600 hover:bg-red-50'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <action.icon className="h-3 w-3" />
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * Toolbar Button Component
 */
function ToolbarButton({ action }) {
    return (
        <button
            onClick={action.onClick}
            disabled={action.disabled}
            className={`p-1 transition-colors ${action.disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : action.destructive
                        ? 'text-gray-400 hover:text-red-600'
                        : action.primary
                            ? 'text-blue-600 hover:text-blue-700'
                            : 'text-gray-400 hover:text-gray-600'
                }`}
            title={action.label}
        >
            <action.icon className="h-3 w-3" />
        </button>
    )
}

export default WidgetToolbar
