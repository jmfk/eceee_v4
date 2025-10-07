/**
 * PageEditor Widget Header
 * 
 * Widget header component specifically designed for PageEditor with
 * version management, publishing controls, layout-specific features, and inheritance support.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    MoreHorizontal,
    Lock,
    ExternalLink
} from 'lucide-react'

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
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)

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

    if (!showControls) {
        return null
    }

    // Handle navigation to parent page
    const handleNavigateToParent = () => {
        if (inheritedFrom && inheritedFrom.id) {
            window.open(`/pages/${inheritedFrom.id}/edit/content`, '_blank')
        }
    }

    return (
        <div className={`widget-header page-editor-header rounded-t px-3 py-2 flex items-center justify-between ${isInherited ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-100 border border-gray-200'} ${className}`}>
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
            )}
        </div>
    )
}

export default PageWidgetHeader
