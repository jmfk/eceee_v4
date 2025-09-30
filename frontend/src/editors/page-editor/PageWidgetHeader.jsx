/**
 * PageEditor Widget Header
 * 
 * Widget header component specifically designed for PageEditor with
 * version management, publishing controls, and layout-specific features.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    MoreHorizontal
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
    className = ''
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

    return (
        <div className={`widget-header page-editor-header bg-gray-100 border border-gray-200 rounded-t px-3 py-2 flex items-center justify-between ${className}`}>
            {/* Left side - Widget info and status */}
            <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-700">
                        {widgetType}
                    </span>
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
        </div>
    )
}

export default PageWidgetHeader
