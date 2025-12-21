/**
 * ObjectEditor Widget Header
 * 
 * Widget header component specifically designed for ObjectEditor with
 * slot-based configurations, object type constraints, and simpler workflows.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    MoreHorizontal,
    AlertTriangle,
    Info,
    Check,
    Clipboard,
    Scissors,
    ClipboardPaste
} from 'lucide-react'
import { copyWidgetsToClipboard, cutWidgetsToClipboard, readClipboardWithMetadata } from '../../utils/clipboardService'
import { useClipboard } from '../../contexts/ClipboardContext'

const ObjectWidgetHeader = ({
    widgetType,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    showControls = true,
    // ObjectEditor-specific props
    slotConfig,
    isRequired = false,
    maxWidgets = null,
    currentIndex = 0,
    className = '',
    // Selection props
    isWidgetSelected = false,
    onToggleWidgetSelection,
    // Copy/Cut/Paste props
    widget = null,
    slotName = null,
    onPaste = null,
    instanceId = null,
    widgetPath = null,
    isCut = false
}) => {
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)
    const { refreshClipboard, pasteModeActive } = useClipboard()

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    const handleMenuToggle = () => {
        setShowMenu(!showMenu)
    }

    const handleCopy = async () => {
        if (widget) {
            await copyWidgetsToClipboard([widget])
            await refreshClipboard()
        }
    }

    const handleCut = async () => {
        if (!widget || !slotName) return

        const cutMetadata = {
            instanceId: instanceId,
            widgetPaths: widgetPath ? [widgetPath] : [`${slotName}/${widget.id}`],
            widgets: {
                [slotName]: [widget.id]
            }
        }

        await cutWidgetsToClipboard([widget], cutMetadata)
        await refreshClipboard()
    }

    const handlePaste = async () => {
        if (!onPaste) return

        const clipboardResult = await readClipboardWithMetadata()
        if (clipboardResult && clipboardResult.data && clipboardResult.data.length > 0) {
            const pastedWidget = clipboardResult.data[0]
            // For ObjectEditor, we'll let handlePasteAtPosition handle the ID generation if needed,
            // or just pass it as is. ReactLayoutRenderer generates new IDs.
            const metadata = clipboardResult.operation === 'cut' ? {
                operation: clipboardResult.operation,
                metadata: clipboardResult.metadata
            } : undefined

            onPaste(pastedWidget, metadata)
        }
    }

    if (!showControls) {
        return null
    }

    return (
        <div className={`widget-header object-editor-header bg-gray-100 border border-gray-200 rounded-t px-3 py-2 flex items-center justify-between ${className}`}>
            {/* Left side - Widget info and constraints */}
            <div className="flex items-center space-x-3">
                {/* Selection checkbox */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleWidgetSelection?.()
                    }}
                    className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${isWidgetSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-white border-gray-300 hover:border-blue-400'
                        }`}
                >
                    {isWidgetSelected && <Check className="h-3 w-3" />}
                </button>

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium text-gray-700 ${isCut ? 'line-through opacity-50' : ''}`}>
                        {widgetType}
                    </span>

                    {/* Required indicator */}
                    {isRequired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Required
                        </span>
                    )}

                    {/* Slot info */}
                    {slotConfig && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            <Info className="h-3 w-3 mr-1" />
                            {slotConfig.label || slotConfig.name}
                        </span>
                    )}

                    {/* Widget count indicator */}
                    {maxWidgets && (
                        <span className="text-xs text-gray-500">
                            {currentIndex + 1}/{maxWidgets}
                        </span>
                    )}
                </div>
            </div>

            {/* Right side - Action buttons */}
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
                <div className="flex items-center border-r border-gray-300 pr-2 mr-2">
                    {widget && (
                        <>
                            <button
                                onClick={handleCopy}
                                className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Copy widget"
                            >
                                <Clipboard className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={handleCut}
                                className="p-1 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title="Cut widget"
                            >
                                <Scissors className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                    {onPaste && (
                        <button
                            onClick={handlePaste}
                            className={`p-1 rounded transition-colors ${pasteModeActive
                                    ? 'text-purple-600 hover:text-purple-700 hover:bg-purple-50 animate-pulse'
                                    : 'text-gray-400 cursor-not-allowed opacity-50'
                                }`}
                            disabled={!pasteModeActive}
                            title="Paste widget after"
                        >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center space-x-1">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                            title="Edit widget configuration"
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* More actions menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={handleMenuToggle}
                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        title="More actions"
                    >
                        <MoreHorizontal className="h-3 w-3" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">

                                {/* Destructive actions */}
                                {onDelete && (
                                    <button
                                        onClick={() => {
                                            onDelete()
                                            setShowMenu(false)
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4 mr-3" />
                                        Delete Widget
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ObjectWidgetHeader
